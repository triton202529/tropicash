import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { summarizeCertification } from "../../lib/oauthWalletCertification";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1400px",
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

const selectBase = {
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
  cursor: "pointer",
};

const inputBase = {
  ...selectBase,
  cursor: "text",
};

const btnPrimary = {
  padding: "0.55rem 1rem",
  fontSize: "0.85rem",
  borderRadius: "10px",
  border: "none",
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const btnSecondary = {
  ...btnPrimary,
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
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

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 14 ? `${s.slice(0, 10)}…` : s;
}

function certStatusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "certified") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #6ee7b7",
    };
  }
  if (key === "failed") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#fffbeb",
    color: "#9a3412",
    border: "1px solid #fcd34d",
  };
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return shortId(userId);
}

export default function OAuthWalletCertificationAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runIdInput, setRunIdInput] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [liveEval, setLiveEval] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [profileMap, setProfileMap] = useState({});
  const [clientMap, setClientMap] = useState({});
  const [appMap, setAppMap] = useState({});

  useEffect(() => {
    const q = router.query?.run_id;
    if (typeof q === "string" && q.trim()) {
      setRunIdInput(q.trim());
    }
  }, [router.query?.run_id]);

  const loadCertifications = useCallback(async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("oauth_wallet_test_certifications")
      .select(
        "id, run_id, user_id, status, passed_count, failed_count, skipped_count, leak_detected, summary, certified_at",
      )
      .order("certified_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message || "Failed to load certifications.");
      setCertifications([]);
      setLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setCertifications(list);

    const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map = {};
      for (const p of profiles || []) map[p.id] = p;
      setProfileMap(map);
    } else {
      setProfileMap({});
    }

    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    void loadCertifications();
  }, [user, userLoading, isAdmin, router, loadCertifications]);

  async function evaluateRun(runId, isReevaluate = false) {
    const rid = String(runId || "").trim();
    if (!rid) {
      setError("Enter a run ID to evaluate.");
      return;
    }

    setEvaluating(true);
    setError("");
    if (!isReevaluate) setLiveEval(null);

    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("oauth_wallet_test_evidence")
      .select(
        "id, user_id, developer_app_id, oauth_client_id, run_id, step_key, step_label, status, http_status, sanitized_result, created_at",
      )
      .eq("run_id", rid)
      .order("created_at", { ascending: true });

    if (evidenceError) {
      setError(evidenceError.message || "Failed to load evidence for run.");
      setEvaluating(false);
      return;
    }

    if (!evidenceRows?.length) {
      setError(`No evidence rows found for run_id: ${rid}`);
      setEvaluating(false);
      return;
    }

    const summary = summarizeCertification(evidenceRows);
    setLiveEval(summary);

    const clientIds = [
      ...new Set(evidenceRows.map((r) => r.oauth_client_id).filter(Boolean)),
    ];
    const appIds = [
      ...new Set(evidenceRows.map((r) => r.developer_app_id).filter(Boolean)),
    ];

    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("oauth_clients")
        .select("id, client_id, client_name")
        .in("id", clientIds);
      const map = { ...clientMap };
      for (const c of clients || []) map[c.id] = c;
      setClientMap(map);
    }
    if (appIds.length) {
      const { data: apps } = await supabase
        .from("developer_apps")
        .select("id, app_name")
        .in("id", appIds);
      const map = { ...appMap };
      for (const a of apps || []) map[a.id] = a;
      setAppMap(map);
    }

    const safeSummary = {
      phase: summary.phase,
      evaluated_at: summary.evaluated_at,
      requiredSteps: summary.requiredSteps,
      missingSteps: summary.missingSteps,
      reasons: summary.reasons,
      leaks: summary.leaks,
      developer_app_id: summary.developer_app_id,
      oauth_client_id: summary.oauth_client_id,
    };

    const { error: upsertError } = await supabase
      .from("oauth_wallet_test_certifications")
      .upsert(
        {
          run_id: rid,
          user_id: summary.user_id,
          status: summary.status,
          passed_count: summary.passedCount,
          failed_count: summary.failedCount,
          skipped_count: summary.skippedCount,
          leak_detected: summary.leakDetected,
          summary: safeSummary,
          certified_at: new Date().toISOString(),
        },
        { onConflict: "run_id" },
      );

    setEvaluating(false);

    if (upsertError) {
      setError(upsertError.message || "Failed to persist certification.");
      return;
    }

    await loadCertifications();
  }

  const displayEval = liveEval || null;

  const enrichedCerts = useMemo(() => {
    return certifications.map((c) => {
      const summary = c.summary && typeof c.summary === "object" ? c.summary : {};
      return {
        ...c,
        appId: summary.developer_app_id,
        clientId: summary.oauth_client_id,
        requiredPresent: Array.isArray(summary.requiredSteps)
          ? summary.requiredSteps.filter((s) => s.present).length
          : null,
        requiredTotal: Array.isArray(summary.requiredSteps)
          ? summary.requiredSteps.length
          : 10,
      };
    });
  }, [certifications]);

  if (userLoading || !user || !isAdmin) {
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
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin
          </Link>
          {" · "}
          <Link
            href="/admin/oauth-wallet-test-evidence"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Evidence
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Wallet Certification
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "760px", lineHeight: 1.5 }}>
          Evaluate saved harness evidence and certify OAuth wallet sandbox runs. Read/evaluate only —
          no evidence edits, no wallet mutation, no money movement.
        </p>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>
            Evaluate run
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 240px" }}>
              <label className="text-xs font-semibold uppercase text-slate-500">Run ID</label>
              <input
                className="tc-admin-in mt-1"
                style={inputBase}
                value={runIdInput}
                onChange={(e) => setRunIdInput(e.target.value)}
                placeholder="owt_…"
              />
            </div>
            <button
              type="button"
              style={btnPrimary}
              disabled={evaluating}
              onClick={() => void evaluateRun(runIdInput, false)}
            >
              {evaluating ? "Evaluating…" : "Evaluate run"}
            </button>
            <button
              type="button"
              style={btnSecondary}
              disabled={evaluating || !runIdInput.trim()}
              onClick={() => void evaluateRun(runIdInput, true)}
            >
              Re-evaluate run
            </button>
          </div>
        </div>

        {displayEval ? (
          <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>
                Result: {shortId(displayEval.run_id)}
              </h2>
              <span style={certStatusStyle(displayEval.status)}>{displayEval.status}</span>
              {displayEval.leakDetected ? (
                <span style={{ fontSize: "0.8rem", color: "#991b1b", fontWeight: 600 }}>
                  Leak detected
                </span>
              ) : null}
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              {displayEval.passedCount} passed · {displayEval.failedCount} failed ·{" "}
              {displayEval.skippedCount} skipped
            </p>
            {displayEval.reasons?.length ? (
              <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569" }}>
                {displayEval.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Step</th>
                  <th style={{ padding: "0.5rem" }}>Present</th>
                  <th style={{ padding: "0.5rem" }}>Status</th>
                  <th style={{ padding: "0.5rem" }}>OK</th>
                </tr>
              </thead>
              <tbody>
                {displayEval.requiredSteps?.map((s) => (
                  <tr key={s.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem" }}>{s.label}</td>
                    <td style={{ padding: "0.5rem" }}>{s.present ? "✓" : "—"}</td>
                    <td style={{ padding: "0.5rem" }}>{s.stepStatus || "—"}</td>
                    <td style={{ padding: "0.5rem", color: s.ok ? "#047857" : "#991b1b" }}>
                      {s.ok ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem" }}>
          <label className="text-xs font-semibold uppercase text-slate-500">Certification status</label>
          <select
            className="tc-admin-in mt-1"
            style={{ ...selectBase, maxWidth: "220px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="certified">Certified</option>
            <option value="failed">Failed</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </div>

        <div style={{ ...cardBase, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading certifications…</p>
          ) : enrichedCerts.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No certifications yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Run ID</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>User</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Steps</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>P / F / S</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Leak</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Certified at</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedCerts.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {shortId(row.run_id)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {userLabel(profileMap[row.user_id], row.user_id)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={certStatusStyle(row.status)}>{row.status}</span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {row.requiredPresent != null
                          ? `${row.requiredPresent}/${row.requiredTotal}`
                          : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {row.passed_count} / {row.failed_count} / {row.skipped_count}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {row.leak_detected ? "Yes" : "No"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                        {formatWhen(row.certified_at)}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <button
                          type="button"
                          style={{ ...btnSecondary, padding: "0.3rem 0.55rem", fontSize: "0.72rem" }}
                          onClick={() => {
                            setRunIdInput(row.run_id);
                            void evaluateRun(row.run_id, true);
                          }}
                        >
                          Re-evaluate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          Docs:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            docs/developer/OAUTH_WALLET_SANDBOX_CERTIFICATION.md
          </code>
        </p>
      </div>
    </>
  );
}
