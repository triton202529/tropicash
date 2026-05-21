import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { formatTopReasons } from "../../lib/riskEngine";
import {
  addRiskReviewCaseNote,
  assignRiskReviewCase,
  fetchRiskCaseAnalytics,
  fetchRiskReviewCase,
  fetchRiskReviewCases,
  generateRiskCaseRecommendation,
  mapRiskCaseTimelineRow,
  mapRiskReviewCaseNoteRow,
  mapRiskReviewCaseRow,
  updateRiskReviewCaseStatus,
} from "../../lib/riskReviewCases";

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

const btnPrimary = {
  padding: "0.55rem 1rem",
  borderRadius: "10px",
  border: "1px solid #0284c7",
  background: "linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "0.88rem",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(14, 165, 233, 0.35)",
};

const btnSecondary = {
  padding: "0.55rem 1rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
};

const btnSm = {
  ...btnSecondary,
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  marginRight: "0.3rem",
  marginBottom: "0.25rem",
};

const adminFocusCss = `
  .tc-rc-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-rc-in::placeholder { color: #94a3b8; }
`;

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pill(bg, fg, border) {
  return {
    display: "inline-block",
    padding: "0.18rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: bg,
    color: fg,
    border: `1px solid ${border}`,
    whiteSpace: "nowrap",
  };
}

function statusStyle(status) {
  const key = String(status || "").toLowerCase();
  const map = {
    open: pill("#eff6ff", "#1d4ed8", "#bfdbfe"),
    reviewing: pill("#fffbeb", "#92400e", "#fcd34d"),
    escalated: pill("#fef2f2", "#991b1b", "#fca5a5"),
    resolved: pill("#ecfdf5", "#166534", "#bbf7d0"),
    false_positive: pill("#f1f5f9", "#64748b", "#e2e8f0"),
  };
  return map[key] || map.open;
}

function priorityStyle(priority) {
  const key = String(priority || "").toLowerCase();
  const map = {
    critical: pill("#450a0a", "#fecaca", "#7f1d1d"),
    high: pill("#fff7ed", "#c2410c", "#fdba74"),
    normal: pill("#f1f5f9", "#475569", "#e2e8f0"),
    low: pill("#ecfdf5", "#166534", "#bbf7d0"),
  };
  return map[key] || map.normal;
}

function riskLevelStyle(level) {
  const key = String(level || "").toLowerCase();
  const map = {
    critical: pill("#450a0a", "#fecaca", "#7f1d1d"),
    high: pill("#fef2f2", "#991b1b", "#fca5a5"),
    medium: pill("#fffbeb", "#92400e", "#fcd34d"),
    low: pill("#ecfdf5", "#166534", "#bbf7d0"),
  };
  return map[key] || map.low;
}

function actionStyle(action) {
  const key = String(action || "").toLowerCase();
  const map = {
    freeze_candidate: pill("#450a0a", "#fecaca", "#7f1d1d"),
    recommend_freeze: pill("#450a0a", "#fecaca", "#7f1d1d"),
    restrict: pill("#fff1f2", "#9f1239", "#fecdd3"),
    recommend_restrict: pill("#fff1f2", "#9f1239", "#fecdd3"),
    review: pill("#fef2f2", "#991b1b", "#fca5a5"),
    recommend_watch: pill("#fff7ed", "#c2410c", "#fdba74"),
    monitor: pill("#eff6ff", "#1d4ed8", "#bfdbfe"),
    recommend_false_positive: pill("#ecfdf5", "#166534", "#bbf7d0"),
    allow: pill("#f1f5f9", "#64748b", "#e2e8f0"),
  };
  return map[key] || map.allow;
}

function severityStyle(severity) {
  const key = String(severity || "").toLowerCase();
  const map = {
    critical: pill("#450a0a", "#fecaca", "#7f1d1d"),
    high: pill("#fef2f2", "#991b1b", "#fca5a5"),
    warning: pill("#fffbeb", "#92400e", "#fcd34d"),
    info: pill("#f1f5f9", "#64748b", "#e2e8f0"),
  };
  return map[key] || map.info;
}

function formatSuggestedAction(action) {
  return String(action || "").replace(/_/g, " ");
}

function CaseDetailPanel({
  caseRow,
  notes,
  timeline,
  recommendation,
  user,
  onClose,
  onRefresh,
  banner,
  setBanner,
}) {
  const [noteInput, setNoteInput] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [busy, setBusy] = useState(false);

  const topReasons = useMemo(() => formatTopReasons(caseRow.reasons, 5), [caseRow.reasons]);

  const guidance = useMemo(
    () => recommendation || generateRiskCaseRecommendation(caseRow),
    [recommendation, caseRow],
  );

  const runAction = useCallback(
    async (fn) => {
      setBusy(true);
      setBanner({ type: null, message: "" });
      try {
        const res = await fn();
        if (!res.success) {
          setBanner({ type: "err", message: res.error || "Action failed." });
          return;
        }
        setBanner({ type: "ok", message: "Updated." });
        await onRefresh();
      } catch (e) {
        setBanner({ type: "err", message: e?.message || "Action failed." });
      } finally {
        setBusy(false);
      }
    },
    [onRefresh, setBanner],
  );

  const handleStatus = (status) => {
    const note =
      status === "resolved" || status === "false_positive"
        ? String(resolutionNote || "").trim() ||
          `Marked as ${status.replace(/_/g, " ")}.`
        : "";
    void runAction(() =>
      updateRiskReviewCaseStatus({
        caseId: caseRow.id,
        status,
        adminUserId: user?.id,
        note,
      }),
    );
  };

  return (
    <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginTop: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
          {caseRow.title || "Risk review case"}
        </h2>
        <button type="button" onClick={onClose} style={btnSecondary}>
          Close detail
        </button>
      </div>

      {banner.message ? (
        <div
          role="status"
          style={{
            padding: "0.65rem 0.85rem",
            marginBottom: "0.85rem",
            borderRadius: "10px",
            border: `1px solid ${banner.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
            background: banner.type === "ok" ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.82rem", color: banner.type === "ok" ? "#166534" : "#991b1b" }}>
            {banner.message}
          </p>
        </div>
      ) : null}

      <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
        {caseRow.summary || "—"}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
          gap: "0.65rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>User ID</p>
          <Link href={`/admin/risk-users/${encodeURIComponent(caseRow.userId)}`} style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.82rem", wordBreak: "break-all" }}>
            {caseRow.userId}
          </Link>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Scores</p>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "#0f172a" }}>
            Risk {caseRow.riskScore} · Conf {caseRow.confidenceScore}% · Trust {caseRow.trustScore > 0 ? "+" : ""}
            {caseRow.trustScore}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Status</p>
          <span style={statusStyle(caseRow.status)}>{caseRow.status}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Recommended</p>
          <span style={actionStyle(caseRow.recommendedAction)}>
            {String(caseRow.recommendedAction || "").replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div
        style={{
          ...cardBase,
          padding: "0.85rem 1rem",
          marginBottom: "1rem",
          background: "#f0f9ff",
          borderColor: "#bae6fd",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>
            Guidance recommendation (not enforcement)
          </p>
          {guidance.repeatRiskSubject ? (
            <span style={pill("#450a0a", "#fecaca", "#7f1d1d")}>
              Repeat Risk Subject · {guidance.priorCaseCount} prior
            </span>
          ) : null}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
            gap: "0.65rem",
            marginBottom: "0.65rem",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Suggested action
            </p>
            <span style={{ ...actionStyle(guidance.suggestedAction), marginTop: "0.25rem" }}>
              {formatSuggestedAction(guidance.suggestedAction)}
            </span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Severity
            </p>
            <span style={{ ...severityStyle(guidance.severity), marginTop: "0.25rem" }}>
              {guidance.severity}
            </span>
          </div>
        </div>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#334155", lineHeight: 1.5 }}>
          {guidance.rationale}
        </p>
        {guidance.indicators?.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            {guidance.indicators.map((ind) => (
              <li key={ind}>{ind}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
          Top reasons
        </p>
        {topReasons.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>—</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "#475569" }}>
            {topReasons.map((r) => (
              <li key={r.code}>{r.display}</li>
            ))}
          </ul>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
            Source snapshot
          </p>
          <pre
            style={{
              margin: 0,
              padding: "0.55rem 0.65rem",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: "0.72rem",
              overflow: "auto",
              maxHeight: "10rem",
            }}
          >
            {JSON.stringify(caseRow.sourceSnapshot || {}, null, 2)}
          </pre>
        </div>
        <div>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
            Decay snapshot
          </p>
          <pre
            style={{
              margin: 0,
              padding: "0.55rem 0.65rem",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: "0.72rem",
              overflow: "auto",
              maxHeight: "10rem",
            }}
          >
            {JSON.stringify(caseRow.decaySnapshot || {}, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ ...cardBase, padding: "0.85rem 1rem", marginBottom: "1rem", background: "#f8fafc" }}>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
          Actions (human review only)
        </p>
        <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.45 }}>
          Status updates and notes only. Does not change account security status, balances, or payment flows.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.65rem" }}>
          {["reviewing", "escalated", "resolved", "false_positive"].map((st) => (
            <button
              key={st}
              type="button"
              disabled={busy || caseRow.status === st}
              onClick={() => handleStatus(st)}
              style={{ ...btnSm, opacity: busy || caseRow.status === st ? 0.5 : 1 }}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || !user?.id}
            onClick={() =>
              void runAction(() =>
                assignRiskReviewCase({
                  caseId: caseRow.id,
                  assignedTo: user.id,
                  adminUserId: user.id,
                }),
              )
            }
            style={{ ...btnSm, opacity: busy || !user?.id ? 0.5 : 1 }}
          >
            Assign to me
          </button>
        </div>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            Resolution note (resolved / false positive)
          </span>
          <textarea
            className="tc-rc-in"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={2}
            placeholder="Optional note when resolving…"
            style={{ ...inputBase, marginTop: "0.35rem", resize: "vertical", minHeight: "3rem" }}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            Admin note
          </span>
          <textarea
            className="tc-rc-in"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            rows={2}
            placeholder="Add investigation note…"
            style={{ ...inputBase, marginTop: "0.35rem", resize: "vertical", minHeight: "3rem" }}
          />
        </label>
        <button
          type="button"
          disabled={busy || !noteInput.trim()}
          onClick={() => {
            const text = noteInput.trim();
            void runAction(async () => {
              const res = await addRiskReviewCaseNote({
                caseId: caseRow.id,
                authorUserId: user?.id,
                note: text,
                noteType: "admin_note",
              });
              if (res.success) setNoteInput("");
              return res;
            });
          }}
          style={{ ...btnPrimary, marginTop: "0.5rem", opacity: busy || !noteInput.trim() ? 0.6 : 1 }}
        >
          Add note
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
          Case timeline
        </p>
        {timeline.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>No timeline events yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {timeline.map((ev) => (
              <li
                key={ev.id}
                style={{
                  padding: "0.65rem 0.75rem",
                  marginBottom: "0.5rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    {ev.eventType.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{formatWhen(ev.createdAt)}</span>
                </div>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                  {ev.title}
                </p>
                {ev.description ? (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {ev.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
          Notes timeline
        </p>
        {notes.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>No notes yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {notes.map((n) => (
              <li
                key={n.id}
                style={{
                  padding: "0.65rem 0.75rem",
                  marginBottom: "0.5rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: n.noteType === "system_event" ? "#fffbeb" : "#ffffff",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    {n.noteType.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{formatWhen(n.createdAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                  {n.note}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminRiskCasesPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [listError, setListError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("");
  const [banner, setBanner] = useState({ type: null, message: "" });

  const [detailCase, setDetailCase] = useState(null);
  const [detailNotes, setDetailNotes] = useState([]);
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailRecommendation, setDetailRecommendation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const selectedCaseId = typeof router.query.case === "string" ? router.query.case : "";

  const loadAnalytics = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetchRiskCaseAnalytics();
      if (res.success) {
        setAnalytics(res);
      } else {
        setAnalytics(null);
      }
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user?.id, user, profile]);

  const loadCases = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setListError(null);
    try {
      const res = await fetchRiskReviewCases({
        status: statusFilter,
        priority: priorityFilter,
        riskLevel: riskLevelFilter,
        limit: 100,
      });
      if (res.tableMissing) {
        setTableMissing(true);
        setCases([]);
        return;
      }
      setTableMissing(false);
      if (!res.success) {
        setListError(res.error || "Failed to load cases.");
        setCases([]);
        return;
      }
      setCases((res.cases || []).map(mapRiskReviewCaseRow).filter(Boolean));
    } catch (e) {
      setListError(e?.message || "Failed to load cases.");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile, statusFilter, priorityFilter, riskLevelFilter]);

  const loadDetail = useCallback(
    async (caseId) => {
      if (!caseId) {
        setDetailCase(null);
        setDetailNotes([]);
        setDetailTimeline([]);
        setDetailRecommendation(null);
        return;
      }
      setDetailLoading(true);
      try {
        const res = await fetchRiskReviewCase(caseId);
        if (!res.success) {
          setBanner({ type: "err", message: res.error || "Could not load case." });
          setDetailCase(null);
          setDetailNotes([]);
          setDetailTimeline([]);
          setDetailRecommendation(null);
          return;
        }
        setDetailCase(mapRiskReviewCaseRow(res.case));
        setDetailNotes((res.notes || []).map(mapRiskReviewCaseNoteRow).filter(Boolean));
        setDetailTimeline((res.timeline || []).map(mapRiskCaseTimelineRow).filter(Boolean));
        setDetailRecommendation(res.recommendation || null);
      } catch (e) {
        setBanner({ type: "err", message: e?.message || "Could not load case." });
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadCases();
    void loadAnalytics();
  }, [authLoading, user, profile, loadCases, loadAnalytics]);

  useEffect(() => {
    if (!router.isReady) return;
    if (selectedCaseId) {
      void loadDetail(selectedCaseId);
    } else {
      setDetailCase(null);
      setDetailNotes([]);
      setDetailTimeline([]);
      setDetailRecommendation(null);
    }
  }, [router.isReady, selectedCaseId, loadDetail]);

  const openCase = (id) => {
    void router.push({ pathname: "/admin/risk-cases", query: { case: id } }, undefined, { shallow: true });
  };

  const closeDetail = () => {
    void router.push("/admin/risk-cases", undefined, { shallow: true });
  };

  const refreshDetail = useCallback(async () => {
    await loadCases();
    await loadAnalytics();
    if (selectedCaseId) await loadDetail(selectedCaseId);
  }, [loadCases, loadAnalytics, loadDetail, selectedCaseId]);

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
          <Link href="/login" style={{ fontWeight: 600, color: "#0ea5e9" }}>
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
      <style>{adminFocusCss}</style>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ display: "inline-block", marginBottom: "0.5rem", fontSize: "0.88rem", fontWeight: 600, color: "#0ea5e9" }}>
            ← Back to Admin
          </Link>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>
            <Link href="/admin/risk" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Risk Intelligence
            </Link>
          </p>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.35rem", letterSpacing: "-0.02em" }}>
            Risk Review Queue
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", maxWidth: "44rem", lineHeight: 1.5 }}>
            Human review cases from stored risk scores. Manual creation only — no automatic account enforcement.
          </p>
        </div>

        {tableMissing ? (
          <div style={{ ...cardBase, padding: "1rem 1.15rem", marginBottom: "1.25rem", borderColor: "#fcd34d", background: "#fffbeb" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e", lineHeight: 1.5 }}>
              Apply <code style={{ fontSize: "0.8rem" }}>supabase/sql/risk_review_cases.sql</code> and{" "}
              <code style={{ fontSize: "0.8rem" }}>supabase/sql/risk_review_cases_phase2d.sql</code> in the Supabase SQL Editor to enable the review queue and timeline.
            </p>
          </div>
        ) : null}

        {!tableMissing ? (
          <div style={{ ...cardBase, padding: "1rem 1.15rem", marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
              Queue KPIs
            </h2>
            {analyticsLoading && !analytics ? (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Loading metrics…</p>
            ) : analytics ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 120px), 1fr))",
                  gap: "0.65rem",
                }}
              >
                {[
                  { label: "Total", value: analytics.total },
                  { label: "Open", value: analytics.open },
                  { label: "Reviewing", value: analytics.reviewing },
                  { label: "Escalated", value: analytics.escalated },
                  { label: "Resolved", value: analytics.resolved },
                  { label: "False positive", value: analytics.falsePositive },
                  {
                    label: "Avg resolution (h)",
                    value: analytics.avgResolutionHours != null ? analytics.avgResolutionHours : "—",
                  },
                  { label: "Repeat-risk users", value: analytics.repeatRiskSubjects },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      padding: "0.55rem 0.65rem",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Metrics unavailable.</p>
            )}
            {analytics?.recommendationDistribution &&
            Object.keys(analytics.recommendationDistribution).length > 0 ? (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                  Recommendation distribution (guidance only)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {Object.entries(analytics.recommendationDistribution).map(([action, count]) => (
                    <span key={action} style={actionStyle(action)}>
                      {formatSuggestedAction(action)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
            Filters
          </h2>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
              alignItems: "end",
            }}
          >
            <label>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Status</span>
              <select className="tc-rc-in" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectBase, marginTop: "0.35rem" }}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="reviewing">Reviewing</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False positive</option>
              </select>
            </label>
            <label>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Priority</span>
              <select className="tc-rc-in" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ ...selectBase, marginTop: "0.35rem" }}>
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Risk level</span>
              <select className="tc-rc-in" value={riskLevelFilter} onChange={(e) => setRiskLevelFilter(e.target.value)} style={{ ...selectBase, marginTop: "0.35rem" }}>
                <option value="">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button type="button" onClick={() => void loadCases()} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.65 : 1 }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
            Case queue
          </h2>
          {listError ? <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#b91c1c" }}>{listError}</p> : null}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: "1100px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {[
                    "Created",
                    "Updated",
                    "Priority",
                    "Status",
                    "Risk level",
                    "Score",
                    "Confidence",
                    "User ID",
                    "Recommended",
                    "Title",
                    "",
                  ].map((h) => (
                    <th key={h || "open"} style={{ textAlign: "left", padding: "0.5rem 0.4rem", fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && cases.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "0.75rem 0.4rem", color: "#64748b" }}>
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && cases.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "0.75rem 0.4rem", color: "#64748b" }}>
                      No review cases yet. Create cases from{" "}
                      <Link href="/admin/risk" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                        Risk Intelligence
                      </Link>
                      .
                    </td>
                  </tr>
                ) : null}
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: selectedCaseId === c.id ? "#f0f9ff" : "transparent",
                    }}
                  >
                    <td style={{ padding: "0.5rem 0.4rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(c.createdAt)}</td>
                    <td style={{ padding: "0.5rem 0.4rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(c.updatedAt)}</td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      <span style={priorityStyle(c.priority)}>{c.priority}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      <span style={statusStyle(c.status)}>{c.status}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      <span style={riskLevelStyle(c.riskLevel)}>{c.riskLevel}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem", fontWeight: 800 }}>{c.riskScore}</td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>{c.confidenceScore}%</td>
                    <td style={{ padding: "0.5rem 0.4rem", wordBreak: "break-all", maxWidth: "10rem" }}>{c.userId}</td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      <span style={actionStyle(c.recommendedAction)}>{String(c.recommendedAction || "").replace(/_/g, " ")}</span>
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem", color: "#475569", maxWidth: "12rem" }}>{c.title || "—"}</td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      <button type="button" onClick={() => openCase(c.id)} style={btnSm}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detailLoading && selectedCaseId ? (
          <p style={{ marginTop: "1rem", color: "#64748b", fontSize: "0.88rem" }}>Loading case detail…</p>
        ) : null}

        {detailCase && !detailLoading ? (
          <CaseDetailPanel
            caseRow={detailCase}
            notes={detailNotes}
            timeline={detailTimeline}
            recommendation={detailRecommendation}
            user={user}
            onClose={closeDetail}
            onRefresh={refreshDetail}
            banner={banner}
            setBanner={setBanner}
          />
        ) : null}
      </div>
    </>
  );
}
