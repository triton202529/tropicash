import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isAdminUser } from "../../lib/adminAccess";
import { fetchKycLimitPolicies, updateKycLimitPolicy } from "../../lib/kycRisk";
import { useUser } from "../../lib/userContext";
import Navbar from "../../components/Navbar";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
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

const inputSm = {
  width: "100%",
  padding: "0.35rem 0.45rem",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "0.78rem",
  boxSizing: "border-box",
};

const ENFORCEMENT_MODES = ["advisory", "soft_block", "hard_block"];

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function emptyDraft(row) {
  return {
    funding_daily_limit: String(row.funding_daily_limit ?? ""),
    send_daily_limit: String(row.send_daily_limit ?? ""),
    withdrawal_daily_limit: String(row.withdrawal_daily_limit ?? ""),
    enforcement_mode: String(row.enforcement_mode || "advisory"),
    is_active: row.is_active !== false,
  };
}

export default function AdminKycLimitsPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [policiesUnavailable, setPoliciesUnavailable] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error, policiesUnavailable: unavailable } = await fetchKycLimitPolicies({ includeInactive: true });
    if (error) {
      setErrorMsg(error.message || "Could not load KYC limit policies.");
      setRows([]);
      setLoading(false);
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.id || r.kyc_status, emptyDraft(r)])));
    setPoliciesUnavailable(!!unavailable);
    setLoading(false);
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const saveRow = async (row) => {
    const key = row.id || row.kyc_status;
    const draft = drafts[key];
    if (!row?.id) {
      setErrorMsg("Policy table unavailable — run phase_11e_kyc_limit_policy.sql before editing.");
      return;
    }
    setBusyId(row.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    const { error } = await updateKycLimitPolicy(row.id, {
      funding_daily_limit: draft.funding_daily_limit,
      send_daily_limit: draft.send_daily_limit,
      withdrawal_daily_limit: draft.withdrawal_daily_limit,
      enforcement_mode: draft.enforcement_mode,
      is_active: draft.is_active,
    });
    if (error) {
      setErrorMsg(error.message || "Update failed.");
    } else {
      setSuccessMsg(`Updated policy for ${row.kyc_status}.`);
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
          {" · "}
          <Link href="/admin/kyc" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            KYC Review
          </Link>
        </div>

        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>
          KYC Limit Policies
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#64748b", maxWidth: "44rem", lineHeight: 1.55 }}>
          Configure daily KYC-based transaction limits and enforcement mode.{" "}
          <strong>Withdrawals are now enforcement-aware.</strong> Funding and send-money remain advisory only.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "1rem",
            marginBottom: "1rem",
            background: "#ecfdf5",
            borderColor: "#a7f3d0",
          }}
        >
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#047857", lineHeight: 1.5, fontWeight: 700 }}>
            Phase 11F — withdrawal enforcement active
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#065f46", lineHeight: 1.5 }}>
            Withdrawals are now enforcement-aware. Funding and send-money are still advisory only.
          </p>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "1rem",
            marginBottom: "1rem",
            background: "#f8fafc",
            borderColor: "#e2e8f0",
          }}
        >
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
            Enforcement mode (withdrawals)
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.55 }}>
            <li>
              <strong>advisory</strong> — no block; over-limit withdrawals allowed with warnings
            </li>
            <li>
              <strong>soft_block</strong> — block over-limit withdrawals with user guidance (link to /kyc when not
              approved)
            </li>
            <li>
              <strong>hard_block</strong> — strict block on over-limit withdrawals
            </li>
          </ul>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fffbeb",
            borderColor: "#fcd34d",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", lineHeight: 1.5 }}>
            Changing a policy to <strong>soft_block</strong> or <strong>hard_block</strong> affects{" "}
            <strong>withdrawals only</strong>. Funding and send-money ignore enforcement mode until a future phase.
          </p>
        </div>

        {policiesUnavailable ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fffbeb", borderColor: "#fcd34d" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
              Policy table unavailable — showing fallback defaults. Run{" "}
              <code>supabase/sql/phase_11e_kyc_limit_policy.sql</code> to enable admin edits.
            </p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        {successMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#ecfdf5", borderColor: "#a7f3d0" }}>
            <p style={{ margin: 0, color: "#047857", fontSize: "0.9rem" }}>{successMsg}</p>
          </div>
        ) : null}

        <div style={{ ...cardBase, overflowX: "auto" }}>
          {loading && rows.length === 0 ? (
            <p style={{ padding: "1.5rem", color: "#64748b" }}>Loading…</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  {[
                    "KYC status",
                    "Funding daily",
                    "Send daily",
                    "Withdrawal daily",
                    "Enforcement",
                    "Active",
                    "Updated",
                    "",
                  ].map((h) => (
                    <th
                      key={h || "actions"}
                      style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#475569",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = r.id || r.kyc_status;
                  const draft = drafts[key] || emptyDraft(r);
                  const busy = busyId === r.id;
                  const readOnly = !r.id;
                  return (
                    <tr key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>
                        {String(r.kyc_status || "").replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", minWidth: "90px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={readOnly || busy}
                          value={draft.funding_daily_limit}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, funding_daily_limit: e.target.value },
                            }))
                          }
                          style={inputSm}
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", minWidth: "90px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={readOnly || busy}
                          value={draft.send_daily_limit}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, send_daily_limit: e.target.value },
                            }))
                          }
                          style={inputSm}
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", minWidth: "90px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={readOnly || busy}
                          value={draft.withdrawal_daily_limit}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, withdrawal_daily_limit: e.target.value },
                            }))
                          }
                          style={inputSm}
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", minWidth: "110px" }}>
                        <select
                          disabled={readOnly || busy}
                          value={draft.enforcement_mode}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, enforcement_mode: e.target.value },
                            }))
                          }
                          style={inputSm}
                        >
                          {ENFORCEMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <input
                          type="checkbox"
                          disabled={readOnly || busy}
                          checked={!!draft.is_active}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: { ...draft, is_active: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap", color: "#64748b" }}>
                        {formatWhen(r.updated_at)}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <button type="button" style={btnSm} disabled={readOnly || busy} onClick={() => void saveRow(r)}>
                          {busy ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#94a3b8" }}>
          Display values: fund ${formatMoney(rows[0]?.funding_daily_limit)} example for first row when loaded. Policies
          have no delete path — deactivate via Active checkbox if needed.
        </p>
      </div>
    </>
  );
}
