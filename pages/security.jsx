import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import {
  getBrowserSecurityDeviceToken,
  revokeUserSession,
  touchCurrentUserSessionActivity,
} from "../lib/security";
import {
  DEFAULT_SECURITY_SETTINGS,
  ensureSecuritySettings,
  getSecuritySettings,
  upsertSecuritySettings,
} from "../lib/securitySettings";

const pageWrap = {
  padding: "1.75rem 1.25rem 3.5rem",
  maxWidth: "960px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
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

function severityBadgeStyle(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "critical") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.5rem",
      borderRadius: "6px",
      fontSize: "0.65rem",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#450a0a",
      color: "#fecaca",
      border: "1px solid #7f1d1d",
    };
  }
  if (key === "high") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.5rem",
      borderRadius: "6px",
      fontSize: "0.65rem",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (key === "warning") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.5rem",
      borderRadius: "6px",
      fontSize: "0.65rem",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fffbeb",
      color: "#92400e",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.15rem 0.5rem",
    borderRadius: "6px",
    fontSize: "0.65rem",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

const EVENT_TYPE_LABELS = {
  login_success: "Successful sign-in",
  session_revoked: "Session revoked",
  suspicious_login: "Suspicious sign-in",
  failed_login: "Failed sign-in attempt",
  password_changed: "Password changed",
  email_changed: "Email changed",
  logout: "Signed out",
};

function eventTypeLabel(type) {
  const t = String(type || "");
  return EVENT_TYPE_LABELS[t] || t.replace(/_/g, " ");
}

const TWO_FACTOR_METHOD_OPTIONS = [
  { id: "email_otp", label: "Email OTP" },
  { id: "authenticator_app", label: "Authenticator app" },
  { id: "sms_otp", label: "SMS OTP" },
];

function SettingsToggle({ id, label, description, checked, disabled, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "0.85rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <label htmlFor={id} style={{ flex: "1 1 auto", minWidth: 0, cursor: disabled ? "not-allowed" : "pointer" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>{label}</p>
        {description ? (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>{description}</p>
        ) : null}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: "2.75rem",
          height: "1.45rem",
          flexShrink: 0,
          accentColor: "#2563eb",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

function SecuritySettingsPanel({
  settings,
  settingsLoading,
  settingsSaving,
  settingsTableMissing,
  settingsBanner,
  onSettingChange,
}) {
  return (
    <div style={{ ...cardBase, padding: "1.15rem 1.2rem", marginBottom: "1.25rem" }}>
      <h2
        style={{
          margin: "0 0 0.35rem",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#64748b",
        }}
      >
        Security settings
      </h2>
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45 }}>
        Control in-app alerts and future protection options. These preferences do not change how you sign in today.
      </p>

      {settingsTableMissing ? (
        <div
          style={{
            padding: "0.75rem 0.85rem",
            borderRadius: "10px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", lineHeight: 1.45 }}>
            Security settings are being prepared. Core account protection is still active.
          </p>
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.72rem", color: "#a16207" }}>
            Apply <code style={{ fontSize: "0.7rem" }}>supabase/sql/security_settings.sql</code> in the Supabase SQL editor to
            enable saved preferences.
          </p>
        </div>
      ) : (
        <>
          {settingsBanner.message ? (
            <div
              role="status"
              style={{
                display: "block",
                padding: "0.65rem 0.85rem",
                marginBottom: "0.75rem",
                borderRadius: "10px",
                border: `1px solid ${settingsBanner.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
                background: settingsBanner.type === "ok" ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.82rem", color: settingsBanner.type === "ok" ? "#166534" : "#991b1b" }}>
                {settingsBanner.message}
                {settingsSaving ? " Saving…" : ""}
              </p>
            </div>
          ) : settingsSaving ? (
            <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", color: "#64748b" }}>Saving…</p>
          ) : null}

          <div style={{ opacity: settingsLoading ? 0.55 : 1, pointerEvents: settingsLoading ? "none" : "auto" }}>
            <SettingsToggle
              id="sec-login-alerts"
              label="Login alerts"
              description="In-app notifications for important account security activity."
              checked={settings.login_alerts_enabled}
              disabled={settingsLoading || settingsSaving}
              onChange={(v) => void onSettingChange("login_alerts_enabled", v)}
            />
            <SettingsToggle
              id="sec-suspicious-login"
              label="Suspicious login alerts"
              description="Notify you when a sign-in looks different from your recent devices."
              checked={settings.suspicious_login_alerts_enabled}
              disabled={settingsLoading || settingsSaving}
              onChange={(v) => void onSettingChange("suspicious_login_alerts_enabled", v)}
            />
            <SettingsToggle
              id="sec-session-revoked"
              label="Session revocation alerts"
              description="Notify you when a saved device session is revoked from Security Center."
              checked={settings.session_revocation_alerts_enabled}
              disabled={settingsLoading || settingsSaving}
              onChange={(v) => void onSettingChange("session_revocation_alerts_enabled", v)}
            />
            <SettingsToggle
              id="sec-trusted-device"
              label="Trusted device review"
              description="Highlight unfamiliar devices when reviewing sessions (recommended)."
              checked={settings.trusted_device_review_enabled}
              disabled={settingsLoading || settingsSaving}
              onChange={(v) => void onSettingChange("trusted_device_review_enabled", v)}
            />

            <div
              style={{
                marginTop: "0.85rem",
                padding: "0.85rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  marginBottom: "0.65rem",
                }}
              >
                <span>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>Two-factor authentication</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                    Extra verification at sign-in. Not enforced yet — preview only.
                  </p>
                </span>
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "6px",
                    background: "#e0f2fe",
                    color: "#0369a1",
                    border: "1px solid #bae6fd",
                  }}
                >
                  Coming soon
                </span>
              </div>
              <fieldset disabled style={{ margin: 0, padding: 0, border: "none", opacity: 0.65 }}>
                <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                  Two-factor method
                </legend>
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {TWO_FACTOR_METHOD_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.85rem",
                        color: "#475569",
                        cursor: "not-allowed",
                      }}
                    >
                      <input type="radio" name="two_factor_method_preview" value={opt.id} disabled />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function eventMetadataSummary(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const parts = [];
  const sid = metadata.session_id;
  if (sid) parts.push(`Session record ${String(sid).slice(0, 8)}…`);
  const src = metadata.authSource;
  if (src) parts.push(`Source: ${String(src)}`);
  if (metadata.isSignUp === true) parts.push("New account");
  const ua = metadata.userAgent;
  if (typeof ua === "string" && ua.trim()) {
    const short = ua.length > 72 ? `${ua.slice(0, 70)}…` : ua;
    parts.push(`Browser: ${short}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export default function SecurityPage() {
  const { user, loading: authLoading } = useUser();
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeSessionCount, setActiveSessionCount] = useState(null);
  const [recentEventCount, setRecentEventCount] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState("");
  const [feedback, setFeedback] = useState({ type: null, message: "" });
  const [revokingId, setRevokingId] = useState(null);
  const [securitySettings, setSecuritySettings] = useState(() => ({ ...DEFAULT_SECURITY_SETTINGS }));
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsTableMissing, setSettingsTableMissing] = useState(false);
  const [settingsBanner, setSettingsBanner] = useState({ type: null, message: "" });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setLoadError(null);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    try {
      const [sessRes, evtRes, activeHead, recentHead] = await Promise.all([
        supabase
          .from("user_sessions")
          .select(
            "id, device_name, browser, os, location, ip_address, last_active_at, revoked_at, revoked_by, revoked, created_at, session_token",
          )
          .eq("user_id", user.id)
          .order("revoked_at", { ascending: true, nullsFirst: true })
          .order("last_active_at", { ascending: false })
          .limit(40),
        supabase
          .from("security_events")
          .select("id, type, severity, description, metadata, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("user_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("revoked_at", null),
        supabase
          .from("security_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", since),
      ]);

      if (sessRes.error) throw sessRes.error;
      if (evtRes.error) throw evtRes.error;
      if (activeHead.error) throw activeHead.error;
      if (recentHead.error) throw recentHead.error;

      setSessions(sessRes.data || []);
      setEvents(evtRes.data || []);
      setActiveSessionCount(typeof activeHead.count === "number" ? activeHead.count : 0);
      setRecentEventCount(typeof recentHead.count === "number" ? recentHead.count : 0);
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || "Could not load security data.");
      setSessions([]);
      setEvents([]);
      setActiveSessionCount(null);
      setRecentEventCount(null);
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setDeviceToken(getBrowserSecurityDeviceToken());
  }, [sessions]);

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setSettingsLoading(true);
    setSettingsBanner({ type: null, message: "" });
    try {
      const ensured = await ensureSecuritySettings(user.id);
      if (ensured.tableMissing) {
        setSettingsTableMissing(true);
        setSecuritySettings({ ...DEFAULT_SECURITY_SETTINGS });
        return;
      }
      setSettingsTableMissing(false);
      const row = await getSecuritySettings(user.id);
      if (row.tableMissing) {
        setSettingsTableMissing(true);
        setSecuritySettings({ ...DEFAULT_SECURITY_SETTINGS });
        return;
      }
      setSecuritySettings({
        login_alerts_enabled: row.login_alerts_enabled,
        suspicious_login_alerts_enabled: row.suspicious_login_alerts_enabled,
        session_revocation_alerts_enabled: row.session_revocation_alerts_enabled,
        two_factor_enabled: row.two_factor_enabled,
        two_factor_method: row.two_factor_method,
        trusted_device_review_enabled: row.trusted_device_review_enabled,
      });
    } catch (e) {
      console.error(e);
      setSettingsTableMissing(false);
      setSecuritySettings({ ...DEFAULT_SECURITY_SETTINGS });
    } finally {
      setSettingsLoading(false);
    }
  }, [user?.id]);

  const handleSettingChange = useCallback(
    async (key, value) => {
      if (!user?.id || settingsTableMissing || settingsSaving) return;
      const prev = securitySettings;
      const next = { ...prev, [key]: value };
      setSecuritySettings(next);
      setSettingsSaving(true);
      setSettingsBanner({ type: null, message: "" });
      try {
        const res = await upsertSecuritySettings(user.id, { [key]: value });
        if (res.tableMissing) {
          setSettingsTableMissing(true);
          setSecuritySettings(prev);
          setSettingsBanner({
            type: "err",
            message: "Security settings are being prepared. Core account protection is still active.",
          });
          return;
        }
        if (!res.ok) {
          setSecuritySettings(prev);
          setSettingsBanner({
            type: "err",
            message: res.error || "Could not save your settings. Please try again.",
          });
          return;
        }
        setSettingsBanner({ type: "ok", message: "Settings saved." });
      } catch (e) {
        setSecuritySettings(prev);
        setSettingsBanner({
          type: "err",
          message: e?.message || "Could not save your settings. Please try again.",
        });
      } finally {
        setSettingsSaving(false);
      }
    },
    [user?.id, settingsTableMissing, settingsSaving, securitySettings],
  );

  useEffect(() => {
    if (authLoading || !user?.id) return;
    void touchCurrentUserSessionActivity(user.id);
    void loadData();
    void loadSettings();
  }, [authLoading, user?.id, loadData, loadSettings]);

  const handleRevokeSession = useCallback(
    async (row) => {
      if (!user?.id || !row?.id) return;
      const revoked = !!row.revoked_at || row.revoked === true;
      if (revoked) return;
      const isCurrent = deviceToken && row.session_token === deviceToken;
      if (isCurrent) return;

      const label = row.device_name || "this device";
      if (!globalThis.confirm(`Revoke the saved session for “${label}”? You can sign in again from that browser if needed.`)) {
        return;
      }

      setFeedback({ type: null, message: "" });
      setRevokingId(row.id);
      try {
        const res = await revokeUserSession({ sessionId: row.id, userId: user.id });
        if (res.success) {
          setFeedback({ type: "ok", message: "Session revoked." });
          await loadData();
        } else {
          setFeedback({
            type: "err",
            message: res.error || "Could not revoke this session. Try again or contact support.",
          });
        }
      } catch (e) {
        setFeedback({
          type: "err",
          message: e?.message || "Something went wrong while revoking the session.",
        });
      } finally {
        setRevokingId(null);
      }
    },
    [user?.id, deviceToken, loadData],
  );

  const latestActivityAt = useMemo(() => {
    let max = 0;
    for (const s of sessions) {
      const t = new Date(s.last_active_at || s.created_at).getTime();
      if (!Number.isNaN(t) && t > max) max = t;
    }
    for (const ev of events) {
      const t = new Date(ev.created_at).getTime();
      if (!Number.isNaN(t) && t > max) max = t;
    }
    return max ? new Date(max).toISOString() : null;
  }, [sessions, events]);

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
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>Security</h1>
          <p style={{ color: "#64748b" }}>Sign in to view your security center.</p>
          <Link href="/login" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: "0 0 0.35rem",
              letterSpacing: "-0.02em",
            }}
          >
            Security center
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", maxWidth: "42rem", lineHeight: 1.5 }}>
            Monitor sign-ins, active browsers, and recent security signals for your Tropicash account.
          </p>
        </div>

        {loadError ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.1rem",
              marginBottom: "1rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#991b1b" }}>{loadError}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#7f1d1d" }}>
              If tables are missing, apply <code style={{ fontSize: "0.72rem" }}>supabase/sql/security_foundation.sql</code> and{" "}
              <code style={{ fontSize: "0.72rem" }}>supabase/sql/security_session_revocation.sql</code> in the Supabase SQL
              editor.
            </p>
          </div>
        ) : null}

        {feedback.message ? (
          <div
            style={{
              ...cardBase,
              padding: "0.75rem 0.95rem",
              marginBottom: "1rem",
              borderColor: feedback.type === "ok" ? "#bbf7d0" : "#fecaca",
              background: feedback.type === "ok" ? "#f0fdf4" : "#fef2f2",
            }}
            role="status"
          >
            <p style={{ margin: 0, fontSize: "0.85rem", color: feedback.type === "ok" ? "#166534" : "#991b1b" }}>
              {feedback.message}
            </p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1.15rem 1.2rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Security overview
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
              gap: "0.75rem",
            }}
          >
            {[
              {
                label: "Active devices",
                value: dataLoading ? "…" : activeSessionCount == null ? "—" : String(activeSessionCount),
              },
              {
                label: "Recent events (7d)",
                value: dataLoading ? "…" : recentEventCount == null ? "—" : String(recentEventCount),
              },
              {
                label: "Latest activity",
                value: dataLoading ? "…" : formatWhen(latestActivityAt),
              },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  borderRadius: "12px",
                  border: "1px solid #e0f2fe",
                  background: "linear-gradient(180deg, #f8fafc 0%, #f0f9ff 100%)",
                  padding: "0.85rem 0.95rem",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  {c.label}
                </p>
                <p
                  style={{
                    margin: "0.4rem 0 0",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: "#0f172a",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <SecuritySettingsPanel
          settings={securitySettings}
          settingsLoading={settingsLoading}
          settingsSaving={settingsSaving}
          settingsTableMissing={settingsTableMissing}
          settingsBanner={settingsBanner}
          onSettingChange={handleSettingChange}
        />

        <div style={{ ...cardBase, padding: "1.15rem 1.2rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#64748b",
                }}
              >
                Connected apps
              </h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45, maxWidth: "32rem" }}>
                Review and revoke third-party applications that can access your Tropicash account through OAuth.
              </p>
            </div>
            <Link
              href="/oauth/apps"
              style={{
                flexShrink: 0,
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#1d4ed8",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Manage connected apps
            </Link>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.15rem 1.2rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "0.78rem",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Devices & sessions
            </h2>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={dataLoading}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.35rem 0.65rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: dataLoading ? "not-allowed" : "pointer",
                opacity: dataLoading ? 0.65 : 1,
              }}
            >
              Refresh
            </button>
          </div>
          <p style={{ margin: "0.5rem 0 0.85rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45 }}>
            Review devices connected to your Tropicash account. Revoke any session you do not recognize. Revoked entries stay
            listed for your records (this does not sign you out of Supabase on other browsers until those sessions expire).
          </p>
          {sessions.length === 0 && !dataLoading ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.88rem" }}>No sessions recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.6rem" }}>
              {sessions.map((row) => {
                const revoked = !!row.revoked_at || row.revoked === true;
                const isCurrent = !revoked && deviceToken && row.session_token === deviceToken;
                const canRevoke = !revoked && !isCurrent;
                return (
                  <li
                    key={row.id}
                    style={{
                      border: `1px solid ${revoked ? "#e2e8f0" : "#e2e8f0"}`,
                      borderRadius: "12px",
                      padding: "0.75rem 0.85rem",
                      background: revoked ? "#f8fafc" : isCurrent ? "#f0fdf4" : "#fafafa",
                      opacity: revoked ? 0.92 : 1,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.65rem" }}>
                      <div style={{ minWidth: 0, flex: "1 1 12rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
                          <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                            {row.device_name || "Unknown device"}
                          </p>
                          {isCurrent ? (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                padding: "0.12rem 0.4rem",
                                borderRadius: "6px",
                                background: "#166534",
                                color: "#ecfdf5",
                              }}
                            >
                              Current device
                            </span>
                          ) : null}
                          <span
                            style={{
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: "0.12rem 0.4rem",
                              borderRadius: "6px",
                              background: revoked ? "#e2e8f0" : "#ecfdf5",
                              color: revoked ? "#475569" : "#166534",
                              border: `1px solid ${revoked ? "#cbd5e1" : "#bbf7d0"}`,
                            }}
                          >
                            {revoked ? "Revoked" : "Active"}
                          </span>
                        </div>
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                          {[row.browser, row.os].filter(Boolean).join(" · ") || "—"}
                          {row.location ? ` · ${row.location}` : ""}
                          {row.ip_address ? ` · ${row.ip_address}` : ""}
                        </p>
                        {revoked && row.revoked_at ? (
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                            Revoked {formatWhen(row.revoked_at)}
                          </p>
                        ) : null}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "0.45rem",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap", textAlign: "right" }}>
                          Last active
                          <br />
                          {formatWhen(row.last_active_at || row.created_at)}
                        </div>
                        {canRevoke ? (
                          <button
                            type="button"
                            disabled={revokingId === row.id || dataLoading}
                            onClick={() => void handleRevokeSession(row)}
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.35rem 0.6rem",
                              borderRadius: "8px",
                              border: "1px solid #fca5a5",
                              background: "#fff1f2",
                              color: "#9f1239",
                              cursor: revokingId === row.id || dataLoading ? "not-allowed" : "pointer",
                              opacity: revokingId === row.id || dataLoading ? 0.65 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {revokingId === row.id ? "Revoking…" : "Revoke"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ ...cardBase, padding: "1.15rem 1.2rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.65rem",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Recent security activity
          </h2>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45 }}>
            Newest first — sign-ins and future automated checks will appear here.
          </p>
          {events.length === 0 && !dataLoading ? (
            <div style={{ padding: "0.5rem 0", color: "#64748b" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", fontWeight: 600, color: "#475569" }}>No security events yet</p>
              <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5 }}>
                Successful sign-ins and session revocations will appear here after the security tables are applied and you use
                the app. If you expected rows already, confirm <code style={{ fontSize: "0.72rem" }}>security_foundation.sql</code>{" "}
                ran in Supabase.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {["Event", "Severity", "Details", "When"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem 0.35rem",
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
                  {events.map((ev) => {
                    const metaLine = eventMetadataSummary(ev.metadata);
                    const isSuspicious = String(ev.type || "") === "suspicious_login";
                    return (
                      <tr
                        key={ev.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: isSuspicious ? "#fffbeb" : undefined,
                          boxShadow: isSuspicious ? "inset 3px 0 0 0 #f59e0b" : undefined,
                        }}
                      >
                        <td style={{ padding: "0.55rem 0.35rem", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{eventTypeLabel(ev.type)}</div>
                          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.15rem", fontFamily: "ui-monospace, monospace" }}>
                            {ev.type}
                          </div>
                        </td>
                        <td style={{ padding: "0.55rem 0.35rem", verticalAlign: "top" }}>
                          <span style={severityBadgeStyle(ev.severity)}>{String(ev.severity || "info")}</span>
                        </td>
                        <td style={{ padding: "0.55rem 0.35rem", color: "#475569", wordBreak: "break-word", verticalAlign: "top" }}>
                          <div>{ev.description || "—"}</div>
                          {isSuspicious ? (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "#92400e",
                                marginTop: "0.45rem",
                                lineHeight: 1.45,
                                padding: "0.45rem 0.5rem",
                                borderRadius: "8px",
                                background: "rgba(255, 251, 235, 0.85)",
                                border: "1px solid #fde68a",
                              }}
                            >
                              We noticed a login pattern that looks different from your recent activity. If this was you, no
                              action is needed. If not, change your password and review your devices above.
                            </div>
                          ) : null}
                          {metaLine ? (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.35rem", lineHeight: 1.4 }}>
                              {metaLine}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.55rem 0.35rem", color: "#64748b", whiteSpace: "nowrap", verticalAlign: "top" }}>
                          {formatWhen(ev.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ ...cardBase, padding: "1.15rem 1.2rem" }}>
          <h2
            style={{
              margin: "0 0 0.65rem",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Security tips
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#334155", fontSize: "0.88rem", lineHeight: 1.55 }}>
            <li>Never share your login credentials or one-time codes with anyone, including support.</li>
            <li>Watch for unfamiliar sessions or sign-in locations in the list above.</li>
            <li>Use a strong, unique password for your Tropicash account.</li>
            <li>Enable two-factor authentication when it becomes available in your region.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
