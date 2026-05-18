import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  calculateLedgerTrialBalance,
  fetchJournalEntries,
  fetchJournalLines,
} from "../../lib/internalLedger";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
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

const sectionHeading = {
  margin: "0 0 0.65rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "All source types" },
  { value: "funding", label: "funding" },
  { value: "withdrawal", label: "withdrawal" },
  { value: "send_money", label: "send_money" },
  { value: "triton_transfer", label: "triton_transfer" },
  { value: "fraud_hold", label: "fraud_hold" },
  { value: "manual_adjustment", label: "manual_adjustment" },
  { value: "fee", label: "fee" },
  { value: "treasury_snapshot", label: "treasury_snapshot" },
];

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function friendlySchemaError(msg) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("does not exist") || m.includes("schema cache") || m.includes("42p01")) {
    return "Ledger tables are not deployed on this database yet, or your session cannot see them.";
  }
  return msg || "Could not load ledger data.";
}

export default function AdminLedgerPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [trial, setTrial] = useState(null);
  const [entries, setEntries] = useState([]);
  const [postedCount, setPostedCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [sourceType, setSourceType] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());
  const [linesByEntry, setLinesByEntry] = useState(() => ({}));
  const [linesLoading, setLinesLoading] = useState(() => ({}));

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorBanner(null);
    try {
      const [tb, je, countRes] = await Promise.all([
        calculateLedgerTrialBalance({ supabaseClient: supabase }),
        fetchJournalEntries({
          supabaseClient: supabase,
          limit: 50,
          beforeIso: null,
          sourceType: sourceType === "all" ? null : sourceType,
          sourceId: null,
        }),
        supabase.from("journal_entries").select("*", { count: "exact", head: true }).eq("status", "posted"),
      ]);

      setTrial(tb);
      if (tb.error) {
        setErrorBanner(friendlySchemaError(tb.error));
      }

      if (je.error) {
        setErrorBanner((prev) => prev || friendlySchemaError(je.error));
        setEntries([]);
      } else {
        setEntries(je.entries || []);
      }

      if (countRes.error) {
        setPostedCount(null);
      } else {
        setPostedCount(typeof countRes.count === "number" ? countRes.count : 0);
      }
    } catch (e) {
      console.error("[admin/ledger]", e);
      setErrorBanner(friendlySchemaError(e?.message));
      setTrial(null);
      setEntries([]);
      setPostedCount(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile, sourceType]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const handleToggleRow = useCallback(
    async (entryId) => {
      const isOpen = expanded.has(entryId);
      if (isOpen) {
        setExpanded((p) => {
          const n = new Set(p);
          n.delete(entryId);
          return n;
        });
        return;
      }
      setExpanded((p) => {
        const n = new Set(p);
        n.add(entryId);
        return n;
      });
      const existing = linesByEntry[entryId];
      if (existing && Array.isArray(existing.lines)) return;
      setLinesLoading((m) => ({ ...m, [entryId]: true }));
      const { lines, error } = await fetchJournalLines({ supabaseClient: supabase, entryId });
      setLinesLoading((m) => ({ ...m, [entryId]: false }));
      if (error) {
        setLinesByEntry((m) => ({ ...m, [entryId]: { error } }));
      } else {
        setLinesByEntry((m) => ({ ...m, [entryId]: { lines } }));
      }
    },
    [expanded, linesByEntry],
  );

  const imbalance = trial ? Number(trial.imbalance) || 0 : 0;

  const summaryCards = useMemo(() => {
    if (!trial) {
      return [
        { label: "Total debits", value: loading ? "…" : "—" },
        { label: "Total credits", value: loading ? "…" : "—" },
        { label: "Imbalance", value: loading ? "…" : "—", warn: false },
        { label: "Posted entries", value: postedCount == null ? "—" : String(postedCount) },
      ];
    }
    return [
      { label: "Total debits", value: formatMoney(trial.totalDebits) },
      { label: "Total credits", value: formatMoney(trial.totalCredits) },
      {
        label: "Imbalance",
        value: formatMoney(imbalance),
        warn: Math.abs(imbalance) >= 1e-6,
      },
      { label: "Posted entries", value: postedCount == null ? "—" : String(postedCount) },
    ];
  }, [trial, loading, postedCount, imbalance]);

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
        </div>

        <h1
          style={{
            fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Internal ledger
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "#64748b", lineHeight: 1.55, maxWidth: "46rem" }}>
          Ledger Phase 1 is running in observation mode. Existing wallet balances remain the source of truth.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.9rem 1rem",
            marginBottom: "1rem",
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#1e3a5f", lineHeight: 1.5 }}>
            <strong>Observation mode:</strong> journal entries are not created automatically from funding, withdrawals,
            or transfers in this phase. Trial balance reflects only rows you (or future server jobs) post explicitly.
          </p>
        </div>

        {errorBanner ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fffbeb",
              borderColor: "#fcd34d",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>{errorBanner}</p>
          </div>
        ) : null}

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Summary</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
              gap: "0.75rem",
            }}
          >
            {summaryCards.map((c) => (
              <div
                key={c.label}
                style={{
                  ...cardBase,
                  padding: "0.85rem 0.95rem",
                  borderColor: c.warn ? "#fecaca" : "#e2e8f0",
                  background: c.warn ? "#fef2f2" : "#fff",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  {c.label}
                </p>
                <p
                  style={{
                    margin: "0.35rem 0 0",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: c.warn ? "#b91c1c" : "#0f172a",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 style={{ ...sectionHeading, margin: 0 }}>Trial balance (posted)</h2>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              style={{
                padding: "0.32rem 0.55rem",
                fontSize: "0.68rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                color: "#0f172a",
                opacity: loading ? 0.65 : 1,
              }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "520px", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Code", "Name", "Type", "Debit", "Credit", "Net"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Code" || h === "Name" || h === "Type" ? "left" : "right",
                        padding: "0.45rem 0.35rem",
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
                {!trial || (trial.accounts || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "0.65rem 0.35rem", color: "#64748b" }}>
                      {loading ? "Loading…" : "No accounts returned (deploy SQL or check admin access)."}
                    </td>
                  </tr>
                ) : (
                  (trial.accounts || []).map((a) => (
                    <tr key={a.accountId || a.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.45rem 0.35rem", fontWeight: 600, color: "#0f172a" }}>{a.code}</td>
                      <td style={{ padding: "0.45rem 0.35rem", color: "#334155" }}>{a.name}</td>
                      <td style={{ padding: "0.45rem 0.35rem", color: "#64748b" }}>{a.accountType}</td>
                      <td style={{ padding: "0.45rem 0.35rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(a.totalDebit)}
                      </td>
                      <td style={{ padding: "0.45rem 0.35rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(a.totalCredit)}
                      </td>
                      <td
                        style={{
                          padding: "0.45rem 0.35rem",
                          textAlign: "right",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: Math.abs(a.net) < 1e-9 ? "#64748b" : "#0f172a",
                        }}
                      >
                        {formatMoney(a.net)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 style={{ ...sectionHeading, margin: 0 }}>Recent journal entries</h2>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#475569" }}>
              <span style={{ fontWeight: 600 }}>Source</span>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                style={{
                  padding: "0.35rem 0.5rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.8rem",
                  background: "#fff",
                }}
              >
                {SOURCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tc-ledger-entries-desktop" style={{ display: "block" }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {["", "Created", "Type", "Source", "Source id", "Status", "Description"].map((h) => (
                      <th
                        key={h || "exp"}
                        style={{
                          textAlign: h === "" ? "center" : "left",
                          width: h === "" ? "2rem" : undefined,
                          padding: "0.45rem 0.35rem",
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
                  {entries.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "0.65rem 0.35rem", color: "#64748b" }}>
                        No journal entries yet.
                      </td>
                    </tr>
                  ) : null}
                  {entries.map((row) => {
                    const open = expanded.has(row.id);
                    const pack = linesByEntry[row.id];
                    return (
                      <Fragment key={row.id}>
                        <tr style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                          <td style={{ padding: "0.4rem", textAlign: "center" }}>
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() => void handleToggleRow(row.id)}
                              style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                background: "#f8fafc",
                                cursor: "pointer",
                                width: "1.75rem",
                                height: "1.75rem",
                                fontWeight: 800,
                              }}
                            >
                              {open ? "−" : "+"}
                            </button>
                          </td>
                          <td style={{ padding: "0.45rem 0.35rem", color: "#64748b", whiteSpace: "nowrap" }}>
                            {formatWhen(row.created_at)}
                          </td>
                          <td style={{ padding: "0.45rem 0.35rem", fontWeight: 600 }}>{row.entry_type}</td>
                          <td style={{ padding: "0.45rem 0.35rem" }}>{row.source_type}</td>
                          <td style={{ padding: "0.45rem 0.35rem", wordBreak: "break-all", fontSize: "0.72rem" }}>
                            {row.source_id || "—"}
                          </td>
                          <td style={{ padding: "0.45rem 0.35rem" }}>{row.status}</td>
                          <td style={{ padding: "0.45rem 0.35rem", color: "#475569" }}>{row.description || "—"}</td>
                        </tr>
                        {open ? (
                          <tr key={`${row.id}-detail`} style={{ background: "#f8fafc" }}>
                            <td />
                            <td colSpan={6} style={{ padding: "0.65rem 0.75rem" }}>
                              {linesLoading[row.id] ? (
                                <p style={{ margin: 0, color: "#64748b" }}>Loading lines…</p>
                              ) : pack?.error ? (
                                <p style={{ margin: 0, color: "#b91c1c" }}>{pack.error}</p>
                              ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: "left", padding: "0.25rem", color: "#94a3b8" }}>Account</th>
                                      <th style={{ textAlign: "right", padding: "0.25rem", color: "#94a3b8" }}>Debit</th>
                                      <th style={{ textAlign: "right", padding: "0.25rem", color: "#94a3b8" }}>Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(pack?.lines || []).map((ln) => (
                                      <tr key={ln.id}>
                                        <td style={{ padding: "0.3rem 0.25rem", fontWeight: 600 }}>
                                          {ln.account_code || ln.account_id}
                                          {ln.account_name ? (
                                            <span style={{ fontWeight: 400, color: "#64748b" }}> — {ln.account_name}</span>
                                          ) : null}
                                        </td>
                                        <td style={{ padding: "0.3rem 0.25rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                          {toNum(ln.debit) > 0 ? formatMoney(ln.debit) : "—"}
                                        </td>
                                        <td style={{ padding: "0.3rem 0.25rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                          {toNum(ln.credit) > 0 ? formatMoney(ln.credit) : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tc-ledger-entries-mobile" style={{ display: "none" }}>
            {entries.length === 0 && !loading ? (
              <p style={{ color: "#64748b", fontSize: "0.88rem" }}>No journal entries yet.</p>
            ) : null}
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {entries.map((row) => {
                const open = expanded.has(row.id);
                const pack = linesByEntry[row.id];
                return (
                  <div key={row.id} style={{ ...cardBase, padding: "0.85rem 0.95rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                          {formatWhen(row.created_at)}
                        </p>
                        <p style={{ margin: "0.35rem 0 0", fontWeight: 700, color: "#0f172a" }}>{row.entry_type}</p>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#475569" }}>
                          {row.source_type}
                          {row.source_id ? (
                            <span style={{ display: "block", wordBreak: "break-all", fontSize: "0.72rem", color: "#64748b" }}>
                              {row.source_id}
                            </span>
                          ) : null}
                        </p>
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>{row.description || "—"}</p>
                      </div>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "6px",
                          background: "#f1f5f9",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {row.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleRow(row.id)}
                      style={{
                        marginTop: "0.65rem",
                        width: "100%",
                        padding: "0.4rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {open ? "Hide lines" : "Show lines"}
                    </button>
                    {open ? (
                      <div style={{ marginTop: "0.65rem" }}>
                        {linesLoading[row.id] ? (
                          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Loading lines…</p>
                        ) : pack?.error ? (
                          <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{pack.error}</p>
                        ) : (
                          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.45rem" }}>
                            {(pack?.lines || []).map((ln) => (
                              <li
                                key={ln.id}
                                style={{
                                  borderTop: "1px solid #e2e8f0",
                                  paddingTop: "0.45rem",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{ln.account_code || ln.account_id}</div>
                                <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{ln.account_name}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
                                  <span style={{ color: "#64748b" }}>Debit</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {toNum(ln.debit) > 0 ? formatMoney(ln.debit) : "—"}
                                  </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ color: "#64748b" }}>Credit</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {toNum(ln.credit) > 0 ? formatMoney(ln.credit) : "—"}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <style jsx global>{`
          @media (max-width: 720px) {
            .tc-ledger-entries-desktop {
              display: none !important;
            }
            .tc-ledger-entries-mobile {
              display: block !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}

function toNum(v) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
