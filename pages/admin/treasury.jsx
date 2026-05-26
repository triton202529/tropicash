import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchTreasurySnapshot, TREASURY_STATUS } from "../../lib/adminTreasury";
import { calculateLedgerTrialBalance } from "../../lib/internalLedger";

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

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginTop: "0.25rem",
};

const sectionHeading = {
  margin: "0 0 0.65rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDateLabel(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  const [y, m, d] = String(yyyyMmDd).split("-").map((n) => Number(n));
  if (!y || !m || !d) return yyyyMmDd;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return yyyyMmDd;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusChipStyle(status) {
  const v = String(status || "").toLowerCase();
  const base = {
    display: "inline-block",
    padding: "0.12rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.62rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  };
  if (v === TREASURY_STATUS.WARNING) {
    return { ...base, background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" };
  }
  if (v === TREASURY_STATUS.ERROR) {
    return { ...base, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
  }
  return { ...base, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
}

function withdrawalBadge(status) {
  const v = String(status || "").toLowerCase();
  const base = {
    display: "inline-block",
    padding: "0.18rem 0.5rem",
    borderRadius: "999px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  };
  if (v === "pending") return { ...base, background: "#fffbeb", color: "#9a3412", border: "1px solid #fcd34d" };
  if (v === "processing") return { ...base, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (v === "paid") return { ...base, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  if (v === "failed") return { ...base, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
  return { ...base, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" };
}

function urgencyChip(reason) {
  const base = {
    display: "inline-block",
    padding: "0.12rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.6rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginRight: "0.25rem",
    whiteSpace: "nowrap",
  };
  if (reason === "over_24h") {
    return { style: { ...base, background: "#fffbeb", color: "#9a3412", border: "1px solid #fcd34d" }, label: "over 24h" };
  }
  if (reason === "large_amount") {
    return { style: { ...base, background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" }, label: "large amount" };
  }
  return { style: { ...base, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }, label: reason };
}

function SkeletonBlock({ height = "1.4rem", width = "60%" }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: "6px",
        background: "linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)",
        backgroundSize: "200% 100%",
        animation: "tcSkel 1.4s ease-in-out infinite",
      }}
    />
  );
}

function SummaryCard({ label, value, subtitle, status, detail }) {
  const isWarn = status === TREASURY_STATUS.WARNING;
  const isErr = status === TREASURY_STATUS.ERROR;
  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#94a3b8",
            lineHeight: 1.3,
            wordBreak: "break-word",
            minWidth: 0,
          }}
        >
          {label}
        </p>
        {status && status !== TREASURY_STATUS.OK ? (
          <span style={statusChipStyle(status)}>{isErr ? "Error" : "Warning"}</span>
        ) : null}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "1.35rem",
          fontWeight: 800,
          color: isErr && (value == null || value === "—") ? "#94a3b8" : "#0f172a",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>
      {subtitle ? (
        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4 }}>{subtitle}</p>
      ) : null}
      {(isWarn || isErr) && detail ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            color: isErr ? "#b91c1c" : "#92400e",
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SkeletonSummaryCard() {
  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      <SkeletonBlock height="0.6rem" width="40%" />
      <SkeletonBlock height="1.6rem" width="70%" />
      <SkeletonBlock height="0.6rem" width="55%" />
    </div>
  );
}

function summaryValueDisplay(field, kind) {
  if (!field) return "—";
  if (field.value == null) return "—";
  if (kind === "money") return formatMoney(field.value);
  if (kind === "count") return formatCount(field.value);
  return String(field.value);
}

function PayoutExposureRow({ row }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: "0.65rem",
        alignItems: "center",
        padding: "0.7rem 0.85rem",
        borderTop: "1px solid #f1f5f9",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          title={row.userLabel}
          style={{
            fontWeight: 600,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.userLabel}
        </div>
        <div
          style={{ fontSize: "0.65rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {row.userId || "—"}
        </div>
      </div>
      <div style={{ fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
        {formatMoney(row.amount)}
      </div>
      <div>
        <span style={withdrawalBadge(row.status)}>{row.status || "—"}</span>
      </div>
      <div style={{ color: "#475569", fontSize: "0.75rem" }}>{formatWhen(row.createdAt)}</div>
      <div style={{ color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.methodLabel}>
        {row.methodLabel}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.75rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.destinationMasked}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
        {row.urgencyReasons.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
            {row.urgencyReasons.map((r) => {
              const c = urgencyChip(r);
              return (
                <span key={r} style={c.style}>
                  {c.label}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>—</span>
        )}
        <Link
          href={`/admin/withdrawals?focus=${encodeURIComponent(row.id)}`}
          style={{ fontSize: "0.7rem", fontWeight: 600, color: "#0ea5e9", whiteSpace: "nowrap" }}
        >
          View in queue
        </Link>
      </div>
    </div>
  );
}

function PayoutExposureCard({ row }) {
  const cellLabel = {
    margin: 0,
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#94a3b8",
  };
  const cellValue = { margin: 0, fontSize: "0.85rem", color: "#0f172a", fontWeight: 600, wordBreak: "break-word" };
  return (
    <div style={{ ...cardBase, padding: "0.85rem 0.95rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={cellLabel}>User</p>
          <p
            title={row.userLabel}
            style={{ ...cellValue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {row.userLabel}
          </p>
        </div>
        <span style={withdrawalBadge(row.status)}>{row.status || "—"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <div>
          <p style={cellLabel}>Amount</p>
          <p style={{ ...cellValue, fontVariantNumeric: "tabular-nums" }}>{formatMoney(row.amount)}</p>
        </div>
        <div>
          <p style={cellLabel}>Created</p>
          <p style={{ ...cellValue, fontWeight: 500, fontSize: "0.78rem", color: "#475569" }}>{formatWhen(row.createdAt)}</p>
        </div>
        <div>
          <p style={cellLabel}>Method</p>
          <p style={{ ...cellValue, fontSize: "0.78rem" }}>{row.methodLabel}</p>
        </div>
        <div>
          <p style={cellLabel}>Destination</p>
          <p style={{ ...cellValue, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.78rem" }}>
            {row.destinationMasked}
          </p>
        </div>
      </div>
      <div>
        <p style={cellLabel}>Urgency</p>
        {row.urgencyReasons.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.2rem" }}>
            {row.urgencyReasons.map((r) => {
              const c = urgencyChip(r);
              return (
                <span key={r} style={c.style}>
                  {c.label}
                </span>
              );
            })}
          </div>
        ) : (
          <p style={{ ...cellValue, color: "#94a3b8", fontWeight: 500, fontSize: "0.78rem" }}>None</p>
        )}
      </div>
      <Link
        href={`/admin/withdrawals?focus=${encodeURIComponent(row.id)}`}
        style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0ea5e9" }}
      >
        View in withdrawals queue →
      </Link>
    </div>
  );
}

function DailyRowDesktop({ row }) {
  const right = { textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#0f172a" };
  return (
    <tr style={{ borderTop: "1px solid #f1f5f9" }}>
      <td style={{ padding: "0.55rem 0.65rem", color: "#0f172a", fontWeight: 600 }}>{formatDateLabel(row.date)}</td>
      <td style={{ padding: "0.55rem 0.65rem", ...right }}>{formatMoney(row.funded)}</td>
      <td style={{ padding: "0.55rem 0.65rem", ...right }}>{formatMoney(row.withdrawn)}</td>
      <td style={{ padding: "0.55rem 0.65rem", ...right }}>{formatMoney(row.sent)}</td>
      <td style={{ padding: "0.55rem 0.65rem", ...right, color: row.net >= 0 ? "#047857" : "#b91c1c" }}>
        {formatMoney(row.net)}
      </td>
      <td style={{ padding: "0.55rem 0.65rem", ...right }}>{formatCount(row.withdrawalRequestsCount)}</td>
      <td style={{ padding: "0.55rem 0.65rem", ...right }}>{formatCount(row.fraudAlertsCount)}</td>
    </tr>
  );
}

function DailyRowCard({ row }) {
  const cellLabel = {
    margin: 0,
    fontSize: "0.6rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "#94a3b8",
  };
  const cellValue = { margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ ...cardBase, padding: "0.8rem 0.9rem" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>{formatDateLabel(row.date)}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem", marginTop: "0.5rem" }}>
        <div>
          <p style={cellLabel}>Funded</p>
          <p style={cellValue}>{formatMoney(row.funded)}</p>
        </div>
        <div>
          <p style={cellLabel}>Withdrawn</p>
          <p style={cellValue}>{formatMoney(row.withdrawn)}</p>
        </div>
        <div>
          <p style={cellLabel}>Sent</p>
          <p style={cellValue}>{formatMoney(row.sent)}</p>
        </div>
        <div>
          <p style={cellLabel}>Net flow</p>
          <p style={{ ...cellValue, color: row.net >= 0 ? "#047857" : "#b91c1c" }}>{formatMoney(row.net)}</p>
        </div>
        <div>
          <p style={cellLabel}>WR count</p>
          <p style={cellValue}>{formatCount(row.withdrawalRequestsCount)}</p>
        </div>
        <div>
          <p style={cellLabel}>Fraud alerts</p>
          <p style={cellValue}>{formatCount(row.fraudAlertsCount)}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminTreasuryPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [ledgerTrial, setLedgerTrial] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setRefreshError(null);
    try {
      try {
        const snap = await fetchTreasurySnapshot(supabase);
        setSnapshot(snap);
      } catch (e) {
        console.error("[admin/treasury] snapshot failed", e);
        setRefreshError("Could not refresh treasury snapshot. See operational logs.");
      }
      const trial = await calculateLedgerTrialBalance({ supabaseClient: supabase });
      setLedgerTrial(trial);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const summaryCards = useMemo(() => {
    if (!snapshot) return null;
    const s = snapshot.summary;
    const pendingCount = s.pendingPayoutObligations?.count;
    const processingCount = s.processingPayouts?.count;
    return [
      {
        key: "totalLiabilities",
        label: "Wallet liabilities",
        value: summaryValueDisplay(s.totalLiabilities, "money"),
        subtitle:
          s.totalLiabilities?.rowsScanned != null
            ? `${formatCount(s.totalLiabilities.rowsScanned)} wallets`
            : "Sum of all wallet balances",
        status: s.totalLiabilities?.status,
        detail: s.totalLiabilities?.detail,
      },
      {
        key: "fundedToday",
        label: "Funded today",
        value: summaryValueDisplay(s.fundedToday, "money"),
        subtitle: "fund_wallet transactions (local day)",
        status: s.fundedToday?.status,
        detail: s.fundedToday?.detail,
      },
      {
        key: "withdrawnToday",
        label: "Withdrawn today",
        value: summaryValueDisplay(s.withdrawnToday, "money"),
        subtitle: "withdraw_wallet transactions",
        status: s.withdrawnToday?.status,
        detail: s.withdrawnToday?.detail,
      },
      {
        key: "netInflowToday",
        label: "Net inflow today",
        value: summaryValueDisplay(s.netInflowToday, "money"),
        subtitle: "Funded − withdrawn",
        status: s.netInflowToday?.status,
        detail: s.netInflowToday?.detail,
      },
      {
        key: "pendingPayoutObligations",
        label: "Pending payout obligations",
        value: summaryValueDisplay(s.pendingPayoutObligations, "money"),
        subtitle: pendingCount == null ? null : `${formatCount(pendingCount)} requests`,
        status: s.pendingPayoutObligations?.status,
        detail: s.pendingPayoutObligations?.detail,
      },
      {
        key: "processingPayouts",
        label: "Processing payouts",
        value: summaryValueDisplay(s.processingPayouts, "money"),
        subtitle: processingCount == null ? null : `${formatCount(processingCount)} requests`,
        status: s.processingPayouts?.status,
        detail: s.processingPayouts?.detail,
      },
    ];
  }, [snapshot]);

  const reconciliationCards = useMemo(() => {
    if (!snapshot) return null;
    const r = snapshot.reconciliation;
    return [
      {
        key: "fundingTotal",
        label: "Funding total (today)",
        value: summaryValueDisplay(r.fundingTotal, "money"),
        status: r.fundingTotal?.status,
        detail: r.fundingTotal?.detail,
      },
      {
        key: "sendTotal",
        label: "Send volume (today)",
        value: summaryValueDisplay(r.sendTotal, "money"),
        status: r.sendTotal?.status,
        detail: r.sendTotal?.detail,
      },
      {
        key: "withdrawalTotal",
        label: "Withdraw total (today)",
        value: summaryValueDisplay(r.withdrawalTotal, "money"),
        status: r.withdrawalTotal?.status,
        detail: r.withdrawalTotal?.detail,
      },
      {
        key: "transactionsToday",
        label: "Transactions (today)",
        value: summaryValueDisplay(r.transactionsToday, "count"),
        status: r.transactionsToday?.status,
        detail: r.transactionsToday?.detail,
      },
      {
        key: "withdrawalRequestsToday",
        label: "Withdrawal requests (today)",
        value: summaryValueDisplay(r.withdrawalRequestsToday, "count"),
        status: r.withdrawalRequestsToday?.status,
        detail: r.withdrawalRequestsToday?.detail,
      },
      {
        key: "openFraudAlerts",
        label: "Open fraud alerts",
        value: summaryValueDisplay(r.openFraudAlerts, "count"),
        status: r.openFraudAlerts?.status,
        detail: r.openFraudAlerts?.detail,
      },
      {
        key: "openOperationalErrors",
        label: "Operational errors (24h)",
        value: summaryValueDisplay(r.openOperationalErrors, "count"),
        status: r.openOperationalErrors?.status,
        detail: r.openOperationalErrors?.detail,
      },
    ];
  }, [snapshot]);

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
            style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}
          >
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

  const generatedLabel = snapshot?.generatedAt ? formatWhen(snapshot.generatedAt) : "—";
  const payoutRows = snapshot?.payoutExposure?.rows || [];
  const dailyRows = snapshot?.daily?.rows || [];
  const tritonTransfers = snapshot?.tritonTransfers || null;
  const tritonStatus = tritonTransfers?.status || TREASURY_STATUS.OK;
  const tritonDetail = tritonTransfers?.detail || null;

  return (
    <>
      <Navbar />
      <style jsx global>{`
        @keyframes tcSkel {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        @media (max-width: 760px) {
          .tc-treasury-payout-desktop {
            display: none !important;
          }
          .tc-treasury-payout-mobile {
            display: grid !important;
          }
          .tc-treasury-daily-desktop {
            display: none !important;
          }
          .tc-treasury-daily-mobile {
            display: grid !important;
          }
        }
        @media (min-width: 761px) {
          .tc-treasury-payout-desktop {
            display: block !important;
          }
          .tc-treasury-payout-mobile {
            display: none !important;
          }
          .tc-treasury-daily-desktop {
            display: block !important;
          }
          .tc-treasury-daily-mobile {
            display: none !important;
          }
        }
      `}</style>
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.65rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 0.4rem",
                letterSpacing: "-0.02em",
              }}
            >
              Treasury &amp; Reconciliation
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, maxWidth: "44rem" }}>
              Read-only admin snapshot. Last refreshed at {generatedLabel}.{" "}
              <Link href="/admin/treasury-intelligence" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Open Treasury Intelligence
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              ...btnSm,
              marginTop: 0,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {refreshError ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{refreshError}</p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "0.9rem 1rem", marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>
            Internal ledger
          </p>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.88rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.45 }}>
            {ledgerTrial == null ? (
              <span style={{ color: "#64748b" }}>Loading ledger status…</span>
            ) : ledgerTrial.error ? (
              <span style={{ color: "#92400e" }}>Ledger unavailable (tables missing or access issue).</span>
            ) : Math.abs(Number(ledgerTrial.imbalance) || 0) < 1e-6 ? (
              <span style={{ color: "#047857" }}>Balanced</span>
            ) : (
              <span style={{ color: "#b91c1c" }}>
                Imbalance: {formatMoney(Number(ledgerTrial.imbalance) || 0)} (posted lines only)
              </span>
            )}
          </p>
          <Link href="/admin/ledger" style={{ display: "inline-block", marginTop: "0.55rem", fontWeight: 600, color: "#0ea5e9", fontSize: "0.82rem" }}>
            Open internal ledger →
          </Link>
        </div>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Summary</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              gap: "0.85rem",
            }}
          >
            {summaryCards
              ? summaryCards.map((c) => (
                  <SummaryCard
                    key={c.key}
                    label={c.label}
                    value={c.value}
                    subtitle={c.subtitle}
                    status={c.status}
                    detail={c.detail}
                  />
                ))
              : Array.from({ length: 6 }).map((_, i) => <SkeletonSummaryCard key={i} />)}
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 style={{ ...sectionHeading, margin: 0 }}>Triton transfer exposure</h2>
            {tritonTransfers && tritonStatus !== TREASURY_STATUS.OK ? (
              <span style={statusChipStyle(tritonStatus)}>
                {tritonStatus === TREASURY_STATUS.ERROR ? "Error" : "Warning"}
              </span>
            ) : null}
          </div>
          {!snapshot ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                gap: "0.85rem",
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonSummaryCard key={i} />
              ))}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                  gap: "0.85rem",
                }}
              >
                <SummaryCard
                  label="Pending → Triton"
                  value={formatMoney(tritonTransfers?.pendingToTriton?.value || 0)}
                  subtitle="Sum of pending wallet→Triton requests"
                  status={tritonTransfers?.pendingToTriton?.status}
                  detail={tritonTransfers?.pendingToTriton?.detail}
                />
                <SummaryCard
                  label="Pending ← Triton"
                  value={formatMoney(tritonTransfers?.pendingFromTriton?.value || 0)}
                  subtitle="Sum of pending Triton→wallet requests"
                  status={tritonTransfers?.pendingFromTriton?.status}
                  detail={tritonTransfers?.pendingFromTriton?.detail}
                />
                <SummaryCard
                  label="Processing"
                  value={formatMoney(tritonTransfers?.processingTotal?.value || 0)}
                  subtitle="Across both directions"
                  status={tritonTransfers?.processingTotal?.status}
                  detail={tritonTransfers?.processingTotal?.detail}
                />
              </div>
              {tritonStatus !== TREASURY_STATUS.OK && tritonDetail ? (
                <p
                  style={{
                    margin: "0.65rem 0 0",
                    fontSize: "0.78rem",
                    color: tritonStatus === TREASURY_STATUS.ERROR ? "#b91c1c" : "#92400e",
                  }}
                >
                  {tritonDetail}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Reconciliation snapshot</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
              gap: "0.65rem",
            }}
          >
            {reconciliationCards
              ? reconciliationCards.map((c) => (
                  <SummaryCard
                    key={c.key}
                    label={c.label}
                    value={c.value}
                    status={c.status}
                    detail={c.detail}
                  />
                ))
              : Array.from({ length: 7 }).map((_, i) => <SkeletonSummaryCard key={i} />)}
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 style={{ ...sectionHeading, margin: 0 }}>Payout exposure</h2>
            {snapshot?.payoutExposure?.status && snapshot.payoutExposure.status !== TREASURY_STATUS.OK ? (
              <span style={statusChipStyle(snapshot.payoutExposure.status)}>
                {snapshot.payoutExposure.status === TREASURY_STATUS.ERROR ? "Error" : "Warning"}
              </span>
            ) : null}
          </div>
          {!snapshot ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <SkeletonBlock height="0.9rem" width="40%" />
              <div style={{ height: "0.75rem" }} />
              <SkeletonBlock height="0.9rem" width="70%" />
              <div style={{ height: "0.75rem" }} />
              <SkeletonBlock height="0.9rem" width="55%" />
            </div>
          ) : payoutRows.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.5rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
                {snapshot.payoutExposure?.status === TREASURY_STATUS.OK
                  ? "No pending or processing payout requests."
                  : snapshot.payoutExposure?.detail || "Payout exposure unavailable."}
              </p>
            </div>
          ) : (
            <>
              <div className="tc-treasury-payout-desktop" style={{ ...cardBase, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr)",
                    gap: "0.65rem",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    background: "#f8fafc",
                  }}
                >
                  <div>User</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div>Created</div>
                  <div>Method</div>
                  <div>Destination</div>
                  <div>Urgency</div>
                </div>
                {payoutRows.map((row) => (
                  <PayoutExposureRow key={row.id} row={row} />
                ))}
              </div>
              <div
                className="tc-treasury-payout-mobile"
                style={{ display: "none", gridTemplateColumns: "1fr", gap: "0.65rem" }}
              >
                {payoutRows.map((row) => (
                  <PayoutExposureCard key={row.id} row={row} />
                ))}
              </div>
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.65rem",
            }}
          >
            <h2 style={{ ...sectionHeading, margin: 0 }}>Daily reconciliation (last 7 days)</h2>
            {snapshot?.daily?.status && snapshot.daily.status !== TREASURY_STATUS.OK ? (
              <span style={statusChipStyle(snapshot.daily.status)}>
                {snapshot.daily.status === TREASURY_STATUS.ERROR ? "Error" : "Warning"}
              </span>
            ) : null}
          </div>
          {!snapshot ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <SkeletonBlock height="0.9rem" width="50%" />
              <div style={{ height: "0.75rem" }} />
              <SkeletonBlock height="0.9rem" width="80%" />
              <div style={{ height: "0.75rem" }} />
              <SkeletonBlock height="0.9rem" width="65%" />
            </div>
          ) : (
            <>
              <div className="tc-treasury-daily-desktop" style={{ ...cardBase, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Date", "Funded", "Withdrawn", "Sent", "Net flow", "Withdrawal requests", "Fraud alerts"].map(
                        (h, idx) => (
                          <th
                            key={h}
                            style={{
                              textAlign: idx === 0 ? "left" : "right",
                              padding: "0.55rem 0.65rem",
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "#94a3b8",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((row) => (
                      <DailyRowDesktop key={row.date} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="tc-treasury-daily-mobile"
                style={{ display: "none", gridTemplateColumns: "1fr", gap: "0.65rem" }}
              >
                {dailyRows.map((row) => (
                  <DailyRowCard key={row.date} row={row} />
                ))}
              </div>
            </>
          )}
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={sectionHeading}>Quick links</h2>
          <div style={{ ...cardBase, padding: "0.85rem 1rem" }}>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.85rem",
                fontSize: "0.85rem",
              }}
            >
              <li>
                <Link href="/admin/withdrawals" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Withdrawals queue
                </Link>
              </li>
              <li>
                <Link href="/admin/fraud" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Fraud dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin/logs" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Operational logs
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
