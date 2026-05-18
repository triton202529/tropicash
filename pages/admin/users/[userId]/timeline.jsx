import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../../lib/supabaseClient";
import { useUser } from "../../../../lib/userContext";
import { isAdminUser } from "../../../../lib/adminAccess";
import Navbar from "../../../../components/Navbar";
import AuditTimelineEmbed from "../../../../components/admin/AuditTimelineEmbed";
import { normalizeRiskFlagsArray } from "../../../../lib/riskFlags";
import { normalizeAccountFlags } from "../../../../lib/accountControls";
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

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  display: "inline-block",
  textDecoration: "none",
};

const labelMuted = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const valueRow = { marginBottom: "0.65rem" };

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

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

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

function formatTxnType(t) {
  const s = String(t || "activity").trim();
  if (!s) return "Activity";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeLogStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "reviewed" || v === "escalated") return v;
  return "open";
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

function alertSeverityBadgeStyle(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "high") return riskBadgeStyle("high");
  if (key === "medium") return riskBadgeStyle("medium");
  return riskBadgeStyle("low");
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

function toneAccent(tone) {
  if (tone === "danger") return "#f87171";
  if (tone === "warning") return "#fbbf24";
  if (tone === "info") return "#60a5fa";
  return "#cbd5e1";
}

function formatFraudLogDescription(row) {
  const typ = formatTxnType(row.transaction_type);
  const amt = formatMoney(row.amount);
  const score = row.risk_score != null ? String(row.risk_score) : "—";
  const st = normalizeLogStatus(row.status);
  const rel = row.related_transaction_id
    ? ` · txn ${String(row.related_transaction_id).slice(0, 8)}…`
    : "";
  return `Fraud log · ${typ} · $${amt} · risk score ${score} · ${st}${rel}`;
}

function toneForFraudLog(row) {
  const lv = String(row.risk_level || "").toLowerCase();
  if (lv === "high") return "danger";
  if (lv === "medium") return "warning";
  return "neutral";
}

function toneForSmartAlert(row) {
  const sev = String(row.severity || "").toLowerCase();
  if (sev === "high") return "danger";
  if (sev === "medium") return "warning";
  const st = String(row.status || "").toLowerCase();
  if (st === "acknowledged") return "info";
  return "neutral";
}

function truncateMessage(msg, max = 220) {
  const s = String(msg || "").trim();
  if (s.length <= max) return s || "—";
  return `${s.slice(0, max - 1)}…`;
}

/**
 * @param {string} userId
 * @param {unknown[]} logs
 * @param {unknown[]} alerts
 */
function buildTimelineItems(userId, logs, alerts) {
  const out = [];

  for (const row of logs) {
    if (!row?.id || !row?.created_at) continue;
    out.push({
      sortKey: new Date(row.created_at).getTime(),
      id: `fraud_log:${row.id}`,
      created_at: row.created_at,
      sourceType: "fraud_log",
      title: "Fraud log recorded",
      description: formatFraudLogDescription(row),
      tone: toneForFraudLog(row),
      badgeLabel: String(row.risk_level || "—").toLowerCase(),
      badgeStyle: riskBadgeStyle(row.risk_level),
      linkHref: `/admin/fraud/${encodeURIComponent(row.id)}`,
      linkLabel: "View fraud log",
    });
  }

  for (const row of alerts) {
    if (!row?.id || !row?.created_at) continue;
    const title = String(row.title || "Smart alert").trim() || "Smart alert";
    const msg = truncateMessage(row.message);
    const typ = row.alert_type ? String(row.alert_type) : "";
    const descParts = [typ && `Type: ${typ}`, msg !== "—" ? msg : null].filter(Boolean);
    out.push({
      sortKey: new Date(row.created_at).getTime(),
      id: `smart_alert:${row.id}`,
      created_at: row.created_at,
      sourceType: "smart_alert",
      title,
      description: descParts.length ? descParts.join(" · ") : "—",
      tone: toneForSmartAlert(row),
      badgeLabel: String(row.severity || row.status || "—").toLowerCase(),
      badgeStyle: alertSeverityBadgeStyle(row.severity),
      linkHref: row.fraud_log_id
        ? `/admin/fraud/${encodeURIComponent(row.fraud_log_id)}`
        : `/admin/risk-users/${encodeURIComponent(userId)}`,
      linkLabel: row.fraud_log_id ? "View fraud log" : "View user risk",
    });
  }

  out.sort((a, b) => b.sortKey - a.sortKey);
  return out;
}

function sourceTypeLabel(st) {
  if (st === "fraud_log") return "Fraud log";
  if (st === "smart_alert") return "Smart alert";
  return st;
}

export default function UserInvestigationTimelinePage() {
  const router = useRouter();
  const rawUserId = router.query?.userId;
  const userId =
    typeof rawUserId === "string" ? rawUserId : Array.isArray(rawUserId) ? rawUserId[0] : null;

  const { user, profile: sessionProfile, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [fetchWarnings, setFetchWarnings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileQueryError, setProfileQueryError] = useState(null);
  const [fraudLogs, setFraudLogs] = useState([]);
  const [smartAlerts, setSmartAlerts] = useState([]);

  const loadTimelineData = useCallback(async () => {
    if (!userId || !user?.id || !isAdminUser(user, sessionProfile)) return;

    setLoading(true);
    setFetchWarnings([]);
    setProfileQueryError(null);

    const warnings = [];

    const profileSelectFull =
      "id, full_name, email, phone, risk_level, risk_flags, account_status, account_flags";
    const profileSelectMin = "id, full_name, email, phone";

    const logsQuery = supabase
      .from("fraud_logs")
      .select(
        "id, created_at, transaction_type, amount, risk_score, risk_level, status, flags, related_transaction_id"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const alertsQuery = supabase
      .from("smart_alerts")
      .select("id, created_at, fraud_log_id, alert_type, severity, status, title, message")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    let profRes;
    try {
      profRes = await supabase
        .from("profiles")
        .select(profileSelectFull)
        .eq("id", userId)
        .maybeSingle();
    } catch (e) {
      console.error("[timeline] profile fetch threw:", e);
      profRes = { data: null, error: e };
    }

    if (profRes.error) {
      try {
        profRes = await supabase
          .from("profiles")
          .select(profileSelectMin)
          .eq("id", userId)
          .maybeSingle();
      } catch (e2) {
        console.error("[timeline] profile fallback threw:", e2);
        profRes = { data: null, error: e2 };
      }
    }

    let logsRes;
    let alertsRes;
    try {
      [logsRes, alertsRes] = await Promise.all([logsQuery, alertsQuery]);
    } catch (e) {
      console.error("[timeline] parallel fetch threw:", e);
      warnings.push(`Data load: ${formatSupabaseError(e)}`);
      setProfile(null);
      setProfileQueryError(profRes.error ? formatSupabaseError(profRes.error) : null);
      setFraudLogs([]);
      setSmartAlerts([]);
      setFetchWarnings(warnings);
      setLoading(false);
      return;
    }

    if (profRes.error) {
      const msg = formatSupabaseError(profRes.error);
      setProfileQueryError(msg);
      setProfile(null);
    } else {
      setProfileQueryError(null);
      setProfile(profRes.data || null);
    }

    if (logsRes.error) {
      console.error("[timeline] fraud_logs:", logsRes.error);
      warnings.push(`Fraud logs: ${formatSupabaseError(logsRes.error)}`);
      setFraudLogs([]);
    } else {
      setFraudLogs(logsRes.data || []);
    }

    if (alertsRes.error) {
      console.error("[timeline] smart_alerts:", alertsRes.error);
      warnings.push(`Smart alerts: ${formatSupabaseError(alertsRes.error)}`);
      setSmartAlerts([]);
    } else {
      setSmartAlerts(alertsRes.data || []);
    }

    setFetchWarnings(warnings);
    setLoading(false);
  }, [userId, user?.id, user, sessionProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isAdminUser(user, sessionProfile)) return;
    if (!router.isReady || !userId) return;
    void loadTimelineData();
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, userId, loadTimelineData]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, sessionProfile)) return;
    if (!router.isReady || !userId) return;

    const filter = { schema: "public", filter: `user_id=eq.${userId}` };
    const sub = (table, suffix) =>
      supabase
        .channel(`user-timeline-${suffix}-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", table, ...filter },
          () => {
            void loadTimelineData();
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") console.error("timeline realtime:", table, err);
        });

    const c1 = sub("smart_alerts", "sa");
    const c2 = sub("fraud_logs", "fl");

    return () => {
      void supabase.removeChannel(c1);
      void supabase.removeChannel(c2);
    };
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, userId, loadTimelineData]);

  const items = useMemo(
    () => (userId ? buildTimelineItems(userId, fraudLogs, smartAlerts) : []),
    [userId, fraudLogs, smartAlerts]
  );

  const displayName = userId ? userLabel(profile, userId) : "—";

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

  if (!router.isReady || !userId) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1rem" }}>
          <Link
            href={`/admin/risk-users/${encodeURIComponent(userId)}`}
            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem", marginRight: "0.75rem" }}
          >
            ← User risk detail
          </Link>
          <Link href="/admin/alerts" style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>
            Alert center
          </Link>
          <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "#64748b" }}>· Live updates</span>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "1.1rem 1.25rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>
              INVESTIGATION TIMELINE
            </p>
            <h1
              style={{
                margin: "0.35rem 0 0",
                fontSize: "1.45rem",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {displayName}
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#64748b", wordBreak: "break-all" }}>
              {userId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTimelineData()}
            disabled={loading}
            style={{
              ...btnSm,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <AuditTimelineEmbed entityType="user" entityId={userId} limit={20} />

        {fetchWarnings.length > 0 ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fffbeb",
              borderColor: "#fcd34d",
              color: "#9a3412",
              fontSize: "0.85rem",
            }}
          >
            <p style={{ margin: "0 0 0.35rem", fontWeight: 700 }}>Partial load notice</p>
            <ul style={{ margin: 0, paddingLeft: "1.15rem" }}>
              {fetchWarnings.map((w, i) => (
                <li key={`tw-${i}`} style={{ marginBottom: "0.25rem" }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
            User summary
          </h2>
          {profileQueryError ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#b45309", lineHeight: 1.45 }}>
              Profile query failed: {profileQueryError}
            </p>
          ) : !profile ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              No profile row for this user id.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "0.65rem 1rem",
              }}
            >
              <div style={valueRow}>
                <div style={labelMuted}>Full name</div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{profile.full_name?.trim() || "—"}</div>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Email</div>
                <div style={{ fontSize: "0.875rem", wordBreak: "break-all", color: "#0f172a" }}>
                  {profile.email?.trim() || "—"}
                </div>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Phone</div>
                <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>{profile.phone || "—"}</div>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Risk level</div>
                <span style={riskBadgeStyle(profile.risk_level)}>{String(profile.risk_level || "—").toLowerCase()}</span>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Account status</div>
                <span style={accountStatusBadgeStyle(profile.account_status || "active")}>
                  {String(profile.account_status || "active").replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ marginBottom: "0.65rem" }}>
                <div style={labelMuted}>Risk flags</div>
                {normalizeRiskFlagsArray(profile.risk_flags).length === 0 ? (
                  <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>—</span>
                ) : (
                  normalizeRiskFlagsArray(profile.risk_flags).map((f, i) => (
                    <span key={`rf-${i}-${f}`} style={chipStyle()}>
                      {f}
                    </span>
                  ))
                )}
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={labelMuted}>Account flags</div>
                {normalizeAccountFlags(profile.account_flags).length === 0 ? (
                  <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>—</span>
                ) : (
                  normalizeAccountFlags(profile.account_flags).map((f, i) => (
                    <span key={`af-${i}-${f}`} style={chipStyle()}>
                      {f}
                    </span>
                  ))
                )}
              </div>
            </div>
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
            Timeline
          </h2>
          {loading && items.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Loading timeline…</p>
          ) : items.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              No fraud logs or smart alerts found for this user yet.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {items.map((it) => (
                <li
                  key={it.id}
                  style={{
                    borderLeft: `3px solid ${toneAccent(it.tone)}`,
                    paddingLeft: "0.85rem",
                    paddingBottom: "1rem",
                    marginBottom: "1rem",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    {formatWhen(it.created_at)}
                    <span style={{ marginLeft: "0.5rem", color: "#94a3b8" }}>{sourceTypeLabel(it.sourceType)}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.45, marginBottom: "0.5rem" }}>
                    {it.description}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
                    <span style={it.badgeStyle}>{it.badgeLabel}</span>
                    {it.linkHref ? (
                      <Link href={it.linkHref} style={{ ...btnSm, margin: 0 }}>
                        {it.linkLabel}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
