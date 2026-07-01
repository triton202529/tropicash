import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import PrivateAlphaDashboard from "../../dashboard/private_alpha_dashboard";
import {
  fetchPrivateAlphaDailyHealth,
  fetchPrivateAlphaMetrics,
  fetchPrivateAlphaReconciliation,
  evaluatePrivateAlphaExit,
} from "../../lib/privateAlphaOps";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
};

const card = {
  background: "#fff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  padding: "1.25rem",
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

export default function PrivateAlphaPage() {
  const { user, profile, isAdminFromRpc, loading: authLoading } = useUser();
  const isAdmin = isAdminUser(user, profile, isAdminFromRpc);

  const [dailyHealth, setDailyHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [incidents, setIncidents] = useState(null);
  const [launchResults, setLaunchResults] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [exitEval, setExitEval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [health, m, recon] = await Promise.all([
        fetchPrivateAlphaDailyHealth({ supabaseClient: supabase }),
        fetchPrivateAlphaMetrics({ supabaseClient: supabase }),
        fetchPrivateAlphaReconciliation({ supabaseClient: supabase }),
      ]);
      setDailyHealth(health?.error ? null : health);
      setMetrics(m?.error ? null : m);
      setReconciliation(recon?.error ? null : recon);

      let inc = null;
      let hist = [];
      let launch = null;
      try {
        const [ir, hr, lr] = await Promise.all([
          fetch("/data/private_alpha/incident_log.json"),
          fetch("/data/private_alpha/daily_health_history.json").catch(() => null),
          fetch("/data/private_alpha/private_alpha_launch_results.json"),
        ]);
        if (ir.ok) inc = await ir.json();
        if (hr?.ok) hist = await hr.json();
        else hist = [];
        if (lr.ok) launch = await lr.json();
      } catch {
        /* optional static artifacts */
      }
      setIncidents(inc);
      setHealthHistory(Array.isArray(hist) ? hist : hist?.days || []);
      setLaunchResults(launch);
      setExitEval(
        evaluatePrivateAlphaExit({
          dailyHealthHistory: Array.isArray(hist) ? hist : hist?.days || [],
          incidentLog: inc,
          metrics: m,
        }),
      );
    } catch (e) {
      setMsg(e?.message || "Could not load Private Alpha dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

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
          <h1>Private Alpha</h1>
          <p>Admin access required.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.55rem", fontWeight: 800 }}>Private Alpha</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.92rem" }}>
              TLP-007 executive operations dashboard · PayPal Sandbox only ·{" "}
              <Link href="/admin/withdrawal-reconciliation" style={{ color: "#0369a1", fontWeight: 600 }}>
                Reconciliation
              </Link>
            </p>
          </div>
          <button type="button" style={btn} onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {msg ? (
          <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{msg}</p>
        ) : null}

        <div style={card}>
          {loading && !dailyHealth ? (
            <p style={{ color: "#64748b" }}>Loading live probes…</p>
          ) : (
            <PrivateAlphaDashboard
              dailyHealth={dailyHealth}
              metrics={metrics}
              reconciliation={reconciliation}
              incidents={incidents}
              exitEval={exitEval}
              launchResults={launchResults}
            />
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
          Docs: docs/private_alpha/ · Daily script:{" "}
          <code style={{ fontSize: "0.75rem" }}>node scripts/tlp007-private-alpha-daily.mjs</code>
          {healthHistory.length > 0 ? ` · ${healthHistory.length} day(s) in health history` : " · Health history accumulates via daily script"}
        </p>
      </div>
    </>
  );
}
