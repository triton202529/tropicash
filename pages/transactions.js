import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
  { id: "funded", label: "Funded" },
  { id: "withdrawn", label: "Withdrawn" },
];

const DATE_FILTERS = [
  { id: "all_time", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
];

function formatMoney(value) {
  const amount = Number(value);
  return Number(Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeStatus(value) {
  const status = String(value || "completed").toLowerCase();
  if (status.includes("pending") || status.includes("processing")) return "pending";
  if (status.includes("fail") || status.includes("cancel") || status.includes("revers")) return "failed";
  return "completed";
}

function normalizeType(type) {
  const raw = String(type || "").toLowerCase();
  if (raw === "send_money") return "send";
  if (raw === "receive_money") return "receive";
  if (raw === "fund_wallet") return "fund";
  if (raw === "withdraw_wallet") return "withdraw";
  return raw;
}

/** PayPal funding context without schema changes (type and optional text fields). */
function isPayPalFundContext(txn) {
  const rawType = String(txn.type || "").toLowerCase();
  if (rawType === "fund_wallet" || rawType === "fund") return true;
  if (normalizeType(txn.type) === "fund") return true;
  const blob = [txn.description, txn.message, txn.notes, txn.memo, txn.reference]
    .filter((v) => v != null && v !== "")
    .map((v) => (typeof v === "string" ? v : String(v)))
    .join(" ")
    .toLowerCase();
  return blob.includes("paypal");
}

function fundingRowLabel(txn) {
  return isPayPalFundContext(txn) ? "Funded (PayPal)" : "Funded";
}

function inDateRange(createdAt, filterId) {
  if (filterId === "all_time") return true;
  const target = new Date(createdAt);
  if (Number.isNaN(target.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filterId === "today") return target >= todayStart;

  if (filterId === "this_week") {
    const weekStart = new Date(todayStart);
    const day = weekStart.getDay();
    const distance = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - distance);
    return target >= weekStart;
  }

  if (filterId === "this_month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return target >= monthStart;
  }
  return true;
}

function startOfDay(dateValue) {
  const d = new Date(dateValue);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function displayName(profileRow, fallbackId) {
  if (!profileRow) return fallbackId || "—";
  return profileRow.full_name?.trim() || profileRow.email?.trim() || fallbackId || "—";
}

function classifyTransaction(txn, currentUserId, namesById) {
  const normalizedType = normalizeType(txn.type);
  const amount = Number(txn.amount) || 0;
  const senderId = txn.sender_id || null;
  const recipientId = txn.recipient_id || null;
  const isSender = senderId === currentUserId;
  const isRecipient = recipientId === currentUserId;
  const isSelf = senderId && recipientId && senderId === currentUserId && recipientId === currentUserId;

  let category = "all";
  let label = "Transaction";
  let direction = "neutral";
  let senderName = senderId ? namesById[senderId] || senderId : "—";
  let recipientName = recipientId ? namesById[recipientId] || recipientId : "—";

  if (normalizedType === "withdraw") {
    category = "withdrawn";
    label = "Withdrawal";
    direction = "outgoing";
    senderName = "You";
    recipientName = "PayPal";
  } else if (normalizedType === "fund") {
    category = "funded";
    label = fundingRowLabel(txn);
    direction = "incoming";
    senderName = "PayPal Sandbox";
    recipientName = "You";
  } else if ((normalizedType === "send" && isSender && !isRecipient) || (isSender && !isRecipient)) {
    category = "sent";
    label = "Sent";
    direction = "outgoing";
    senderName = "You";
    recipientName = namesById[recipientId] || recipientId || "Recipient";
  } else if (
    normalizedType === "receive" ||
    (normalizedType === "send" && isRecipient && !isSender) ||
    (isRecipient && !isSender)
  ) {
    category = "received";
    label = "Received";
    direction = "incoming";
    senderName = namesById[senderId] || senderId || "Sender";
    recipientName = "You";
  } else if (isSelf) {
    category = "funded";
    label = fundingRowLabel(txn);
    direction = "neutral";
    senderName = "You";
    recipientName = "You";
  }

  const sign = direction === "outgoing" ? "-" : direction === "incoming" ? "+" : "";
  const amountLine = `${sign}$${formatMoney(amount)}`;
  const bucketLabel = category === "funded" || category === "withdrawn" ? "Wallet" : "Transfer";
  const description =
    category === "sent"
      ? `To ${recipientName}`
      : category === "received"
        ? `From ${senderName}`
        : category === "withdrawn"
          ? "To bank / external account"
          : category === "funded"
            ? isPayPalFundContext(txn)
              ? "From PayPal Sandbox"
              : "From bank / card"
            : "Wallet activity";

  return {
    ...txn,
    category,
    label,
    senderName: senderName === currentUserId ? "You" : senderName,
    recipientName: recipientName === currentUserId ? "You" : recipientName,
    bucketLabel,
    direction,
    amountLine,
    dateLine: formatWhen(txn.created_at),
    statusLine: txn.status ? String(txn.status) : "completed",
    description,
    amountValue: amount,
  };
}

function iconForType(category) {
  if (category === "sent") return { symbol: "↑", color: "#dc2626", bg: "#fee2e2" };
  if (category === "received") return { symbol: "↓", color: "#059669", bg: "#d1fae5" };
  if (category === "withdrawn") return { symbol: "-", color: "#dc2626", bg: "#fee2e2" };
  return { symbol: "+", color: "#16a34a", bg: "#dcfce7" };
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user, loading: authLoading, profile } = useUser();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeDateFilter, setActiveDateFilter] = useState("all_time");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRows([]);
      setProfilesMap({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      const { data: txns, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (txError) {
        console.error("[transactions] fetch failed:", txError);
        setRows([]);
        setProfilesMap({});
        setErrorMsg("Could not load your transactions right now.");
        setLoading(false);
        return;
      }

      const txnRows = txns || [];
      setRows(txnRows);

      const idSet = new Set();
      txnRows.forEach((txn) => {
        if (txn.sender_id) idSet.add(txn.sender_id);
        if (txn.recipient_id) idSet.add(txn.recipient_id);
      });
      const ids = [...idSet];
      if (!ids.length) {
        setProfilesMap({});
        setLoading(false);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);

      if (cancelled) return;
      if (profileError) {
        console.error("[transactions] profile lookup failed:", profileError);
        setProfilesMap({});
      } else {
        const nextMap = {};
        (profileRows || []).forEach((row) => {
          nextMap[row.id] = displayName(row);
        });
        if (user.id && !nextMap[user.id]) {
          nextMap[user.id] = profile?.full_name?.trim() || profile?.email?.trim() || "You";
        }
        setProfilesMap(nextMap);
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.email, profile?.full_name, user?.id]);

  const enrichedRows = useMemo(() => {
    if (!user?.id) return [];
    return rows.map((txn) => classifyTransaction(txn, user.id, profilesMap));
  }, [rows, user?.id, profilesMap]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrichedRows.filter((row) => {
      const matchesCategory = activeFilter === "all" ? true : row.category === activeFilter;
      const matchesDate = inDateRange(row.created_at, activeDateFilter);
      const payPalHaystack =
        row.category === "funded" || isPayPalFundContext(row)
          ? "paypal pay pal sandbox fund_wallet funded funded (paypal)"
          : "";
      const haystack = `${row.senderName} ${row.recipientName} ${row.description} ${row.label} ${String(
        row.id
      )} ${payPalHaystack}`.toLowerCase();
      const matchesSearch = query ? haystack.includes(query) : true;
      return matchesCategory && matchesDate && matchesSearch;
    });
  }, [enrichedRows, activeFilter, activeDateFilter, searchQuery]);

  if (!authLoading && !user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={pageTitle}>Transaction History</h1>
          <p style={subtleText}>Sign in to view your wallet activity.</p>
          <Link href="/login" style={linkBtn}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes txShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
            .tx-row { transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease; }
            .tx-row:hover { transform: scale(1.01); box-shadow: 0 16px 30px rgba(15, 23, 42, 0.14); border-color: #cbd5e1; }
            .tx-row:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
          `,
        }}
      />
      <div style={pageShell}>
        <div style={headerRow}>
          <div>
            <h1 style={pageTitle}>Transaction History</h1>
            <p style={subtleText}>All wallet activity, newest first.</p>
          </div>
          <Link href="/insights" style={insightsLink}>
            View Insights
          </Link>
        </div>

        <div style={searchWrap}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, PayPal, or transaction ID"
            style={searchInput}
          />
        </div>

        <div style={filterWrap}>
          {FILTERS.map((filter) => {
            const active = filter.id === activeFilter;
            return (
              <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} style={active ? filterBtnActive : filterBtn}>
                {filter.label}
              </button>
            );
          })}
        </div>

        <div style={{ ...filterWrap, marginTop: "0.55rem" }}>
          {DATE_FILTERS.map((filter) => {
            const active = filter.id === activeDateFilter;
            return (
              <button key={filter.id} type="button" onClick={() => setActiveDateFilter(filter.id)} style={active ? filterBtnActive : filterBtn}>
                {filter.label}
              </button>
            );
          })}
        </div>

        {authLoading || loading ? (
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={skeletonRow}>
                <div style={skeletonIcon} />
                <div style={{ flex: 1 }}>
                  <div style={skeletonLineWide} />
                  <div style={skeletonLineMed} />
                  <div style={skeletonLineSm} />
                </div>
                <div style={skeletonAmount} />
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          <div style={stateCard}>
            <p style={stateTitle}>{errorMsg}</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={stateCard}>
            <div style={emptyIcon}>◌</div>
            <p style={stateTitle}>No transactions yet</p>
            <p style={stateDescription}>Your activity will appear here once you start using Tropicash</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={stateCard}>
            <p style={stateTitle}>No matching transactions</p>
            <p style={stateDescription}>Try switching filters or search terms.</p>
          </div>
        ) : (
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
            {filteredRows.map((row) => {
              const amountStyle = row.direction === "outgoing" ? amountOut : row.direction === "incoming" ? amountIn : amountNeutral;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => router.push(`/transactions/${encodeURIComponent(String(row.id))}`)}
                  style={rowBtn}
                  className="tx-row tropicash-surface"
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          ...iconBubble,
                          color: iconForType(row.category).color,
                          background: iconForType(row.category).bg,
                        }}
                      >
                        {iconForType(row.category).symbol}
                      </span>
                      <span style={rowLabel}>{row.label}</span>
                      <span style={friendlyPill}>{row.bucketLabel}</span>
                      <span
                        style={{
                          ...statusPill,
                          ...(normalizeStatus(row.statusLine) === "completed"
                            ? statusComplete
                            : normalizeStatus(row.statusLine) === "pending"
                              ? statusPending
                              : statusFailed),
                        }}
                      >
                        {normalizeStatus(row.statusLine)}
                      </span>
                    </div>
                    <p style={rowDescription}>{row.description}</p>
                    <p style={rowDate}>{row.dateLine}</p>
                  </div>
                  <div style={amountStyle}>{row.amountLine}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const pageShell = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "640px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const pageTitle = { margin: 0, color: "#0f172a", fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em" };
const subtleText = { margin: "0.45rem 0 0", color: "#94a3b8", fontSize: "0.92rem" };
const filterWrap = { marginTop: "1.2rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" };
const filterBtn = {
  border: "1px solid rgba(148, 163, 184, 0.4)",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "999px",
  padding: "0.45rem 0.8rem",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
};
const filterBtnActive = {
  ...filterBtn,
  border: "1px solid rgba(59, 130, 246, 0.7)",
  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
  color: "#ffffff",
};
const rowBtn = {
  width: "100%",
  textAlign: "left",
  borderRadius: "14px",
  padding: "0.95rem 1rem",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.8rem",
};
const iconBubble = {
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "0.82rem",
};
const rowLabel = { color: "#0f172a", fontWeight: 700, fontSize: "0.96rem" };
const friendlyPill = {
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  background: "#f1f5f9",
  padding: "0.18rem 0.45rem",
  borderRadius: "999px",
};
const rowDescription = {
  margin: "0.3rem 0 0",
  fontSize: "0.85rem",
  color: "#64748b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowDate = { margin: "0.25rem 0 0", fontSize: "0.77rem", color: "#94a3b8" };
const amountBase = { fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: "1rem", whiteSpace: "nowrap" };
const amountIn = { ...amountBase, color: "#059669" };
const amountOut = { ...amountBase, color: "#dc2626" };
const amountNeutral = { ...amountBase, color: "#334155" };
const stateCard = {
  marginTop: "1rem",
  border: "1px dashed rgba(148, 163, 184, 0.45)",
  background: "rgba(255, 255, 255, 0.92)",
  borderRadius: "14px",
  padding: "1.6rem 1.1rem",
  textAlign: "center",
};
const stateTitle = { margin: 0, color: "#0f172a", fontWeight: 700 };
const stateDescription = { margin: "0.45rem 0 0", color: "#64748b", fontSize: "0.88rem" };
const emptyIcon = {
  width: "42px",
  height: "42px",
  borderRadius: "999px",
  background: "#e2e8f0",
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 0.6rem",
  fontWeight: 700,
};
const statusPill = {
  fontSize: "0.69rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderRadius: "999px",
  padding: "0.16rem 0.42rem",
  border: "1px solid transparent",
};
const statusComplete = { color: "#065f46", background: "#d1fae5", borderColor: "#a7f3d0" };
const statusPending = { color: "#92400e", background: "#fef3c7", borderColor: "#fde68a" };
const statusFailed = { color: "#991b1b", background: "#fee2e2", borderColor: "#fecaca" };
const searchWrap = { marginTop: "1rem" };
const searchInput = {
  width: "100%",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "0.7rem 0.82rem",
  fontSize: "0.92rem",
  outline: "none",
};
const skeletonBase = {
  borderRadius: "8px",
  background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%)",
  backgroundSize: "800px 100%",
  animation: "txShimmer 1.2s ease-in-out infinite",
};
const skeletonRow = { ...rowBtn, pointerEvents: "none", padding: "1rem" };
const skeletonIcon = { ...skeletonBase, width: "24px", height: "24px", borderRadius: "999px" };
const skeletonLineWide = { ...skeletonBase, height: "12px", width: "72%" };
const skeletonLineMed = { ...skeletonBase, height: "10px", width: "56%", marginTop: "0.5rem" };
const skeletonLineSm = { ...skeletonBase, height: "9px", width: "36%", marginTop: "0.5rem" };
const skeletonAmount = { ...skeletonBase, width: "74px", height: "16px" };
const linkBtn = { display: "inline-block", marginTop: "0.9rem", color: "#0ea5e9", fontWeight: 600, textDecoration: "none" };
const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
  flexWrap: "wrap",
};
const insightsLink = {
  marginTop: "0.15rem",
  textDecoration: "none",
  color: "#0ea5e9",
  border: "1px solid rgba(14, 165, 233, 0.35)",
  background: "rgba(255,255,255,0.95)",
  borderRadius: "999px",
  padding: "0.38rem 0.72rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};
