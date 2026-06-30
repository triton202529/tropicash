import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import ComplianceGovernanceDashboard from "../../dashboard/compliance_governance_dashboard";
import { fetchComplianceGovernanceSnapshot } from "../../lib/complianceGovernance";
import { fetchAmlCases } from "../../lib/complianceAmlCases";
import { fetchComplianceScreenings, SCREENING_STATUSES } from "../../lib/complianceScreening";
import { fetchComplianceIncidents } from "../../lib/complianceIncidents";
import { fetchComplianceAccountActions } from "../../lib/complianceAccountActions";
import {
  AML_CASE_STATUSES,
  AML_PRIORITIES,
  AML_CASE_TYPES,
} from "../../lib/complianceAmlCases";
import { COMPLIANCE_ACCOUNT_ACTIONS } from "../../lib/complianceAccountActions";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
};

const card = {
  background: "#fff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  padding: "1.25rem",
  marginBottom: "1rem",
};

const btn = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.78rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

async function complianceApi(accessToken, payload) {
  const res = await fetch("/api/admin/compliance/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

export default function ComplianceGovernancePage() {
  const { user, profile, isAdminFromRpc, loading: authLoading } = useUser();
  const isAdmin = isAdminUser(user, profile, isAdminFromRpc);

  const [stats, setStats] = useState(null);
  const [amlCases, setAmlCases] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [accountActions, setAccountActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [readiness, setReadiness] = useState(null);

  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [accountUserId, setAccountUserId] = useState("");
  const [accountReason, setAccountReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [snap, aml, scr, inc, acts] = await Promise.all([
        fetchComplianceGovernanceSnapshot({ supabaseClient: supabase }),
        fetchAmlCases({ supabaseClient: supabase, limit: 20 }),
        fetchComplianceScreenings({ supabaseClient: supabase, status: "pending_review", limit: 20 }),
        fetchComplianceIncidents({ supabaseClient: supabase, limit: 15 }),
        fetchComplianceAccountActions({ supabaseClient: supabase, limit: 15 }),
      ]);
      setStats(snap);
      setAmlCases(aml.rows || []);
      setScreenings(scr.rows || []);
      setIncidents(inc.rows || []);
      setAccountActions(acts.rows || []);

      try {
        const r = await fetch("/data/compliance/compliance_readiness.json");
        if (r.ok) setReadiness(await r.json());
      } catch {
        /* optional snapshot */
      }
    } catch (e) {
      setMsg(e?.message || "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function withToken(fn) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Sign in again");
    return fn(token);
  }

  async function handleCreateAmlCase(e) {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;
    try {
      await withToken((token) =>
        complianceApi(token, {
          action: "create_aml_case",
          title: newCaseTitle.trim(),
          case_type: "investigation",
          priority: "normal",
        }),
      );
      setNewCaseTitle("");
      setMsg("AML case created");
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function handleAccountAction(actionType) {
    if (!accountUserId.trim() || !accountReason.trim()) {
      setMsg("User ID and reason required for account actions");
      return;
    }
    try {
      await withToken((token) =>
        complianceApi(token, {
          action: "account_action",
          user_id: accountUserId.trim(),
          action_type: actionType,
          reason: accountReason.trim(),
        }),
      );
      setMsg(`Account action '${actionType}' recorded`);
      setAccountReason("");
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function resolveScreening(id, status) {
    try {
      await withToken((token) =>
        complianceApi(token, {
          action: "resolve_screening",
          screening_id: id,
          status,
          override_reason: status === "manual_override" ? "Admin manual override" : undefined,
        }),
      );
      setMsg(`Screening ${status}`);
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>Loading…</div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Compliance &amp; governance</h1>
          <p>Admin access required.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.55rem", fontWeight: 800, color: "#0f172a" }}>
            Compliance &amp; governance
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.92rem" }}>
            TLP-005 — AML review, screening, account controls, and incidents.{" "}
            <Link href="/admin/compliance-checklist" style={{ color: "#0369a1", fontWeight: 600 }}>
              Compliance checklist
            </Link>
          </p>
        </div>

        {msg ? (
          <p style={{ padding: "0.65rem 0.85rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", fontSize: "0.85rem" }}>
            {msg}
          </p>
        ) : null}

        <div style={card}>
          <ComplianceGovernanceDashboard stats={stats || {}} readiness={readiness} />
          <button type="button" style={{ ...btn, marginTop: "0.75rem" }} onClick={() => load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          <div style={card}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>AML investigation queue</h2>
            <form onSubmit={handleCreateAmlCase} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <input
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                placeholder="New case title"
                style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              <button type="submit" style={btn}>
                Create
              </button>
            </form>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "0.82rem" }}>
              {amlCases.length === 0 ? (
                <li style={{ color: "#64748b" }}>No AML cases</li>
              ) : (
                amlCases.map((c) => (
                  <li key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    <strong>{c.title}</strong>
                    <span style={{ marginLeft: "0.5rem", color: "#64748b" }}>
                      {c.status} · {c.priority}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
              Statuses: {AML_CASE_STATUSES.join(", ")}
            </p>
          </div>

          <div style={card}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Sanctions / PEP screening</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "0.82rem" }}>
              {screenings.length === 0 ? (
                <li style={{ color: "#64748b" }}>No pending screenings</li>
              ) : (
                screenings.map((s) => (
                  <li key={s.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      {s.screening_type} · {s.subject_name || s.user_id?.slice(0, 8)}
                    </div>
                    <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {["approved", "rejected", "manual_override"].map((st) => (
                        <button key={st} type="button" style={btn} onClick={() => resolveScreening(s.id, st)}>
                          {st}
                        </button>
                      ))}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Account controls (audited)</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <input
              value={accountUserId}
              onChange={(e) => setAccountUserId(e.target.value)}
              placeholder="User UUID"
              style={{ minWidth: "240px", padding: "0.45rem 0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
            <input
              value={accountReason}
              onChange={(e) => setAccountReason(e.target.value)}
              placeholder="Reason (required)"
              style={{ flex: 1, minWidth: "200px", padding: "0.45rem 0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {COMPLIANCE_ACCOUNT_ACTIONS.map((a) => (
              <button key={a} type="button" style={btn} onClick={() => handleAccountAction(a)}>
                {a.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", fontWeight: 700 }}>Recent actions</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "0.78rem", color: "#475569" }}>
            {accountActions.map((a) => (
              <li key={a.id} style={{ padding: "0.35rem 0" }}>
                {a.action_type} · {a.user_id?.slice(0, 8)}… · {a.reason?.slice(0, 60)}
              </li>
            ))}
          </ul>
        </div>

        <div style={card}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>Open incidents</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "0.82rem" }}>
            {incidents.filter((i) => !["closed", "resolved"].includes(i.status)).map((i) => (
              <li key={i.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9" }}>
                [{i.severity}] {i.title} — {i.status}
              </li>
            ))}
            {incidents.length === 0 ? <li style={{ color: "#64748b" }}>No incidents</li> : null}
          </ul>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem" }}>
            See docs/compliance/INCIDENT_RESPONSE_PLAYBOOK.md for operator procedures.
          </p>
        </div>

        <p style={{ fontSize: "0.78rem", color: "#64748b" }}>
          Case types: {AML_CASE_TYPES.join(", ")} · Screening: {SCREENING_STATUSES.join(", ")} · Priorities:{" "}
          {AML_PRIORITIES.join(", ")}
        </p>
      </div>
    </>
  );
}
