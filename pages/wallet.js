import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import { fetchUserWithdrawalRequests } from "../lib/withdrawalRequests";

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function displayNameFromProfile(p) {
  if (!p) return null;
  return p.full_name?.trim() || p.email?.trim() || null;
}

function withdrawalStatusLabel(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "processing") return "Processing";
  if (v === "paid") return "Paid";
  if (v === "rejected") return "Rejected";
  return v ? String(status) : "—";
}

function formatShortWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeTransactionType(typeRaw) {
  const t = String(typeRaw || "").toLowerCase();
  if (t === "send_money") return "send";
  if (t === "receive_money") return "receive";
  if (t === "fund_wallet") return "fund";
  if (t === "withdraw_wallet") return "withdraw";
  return t;
}

function classifyPreview(txn, userId, namesById) {
  const type = normalizeTransactionType(txn.type);
  const amount = Number(txn.amount) || 0;
  const senderId = txn.sender_id || null;
  const recipientId = txn.recipient_id || null;
  const isSender = senderId === userId;
  const isRecipient = recipientId === userId;
  const isSelf = senderId && recipientId && senderId === userId && recipientId === userId;

  let label = "Activity";
  let direction = "neutral";
  let partyLine = null;

  if (type === "withdraw") {
    label = "Withdrawn";
    direction = "outgoing";
    partyLine = "To bank / external";
  } else if (type === "fund") {
    label = "Funded";
    direction = "incoming";
    partyLine = "From bank / card";
  } else if ((type === "send" && isSender && !isRecipient) || (isSender && !isRecipient)) {
    label = "Sent";
    direction = "outgoing";
    partyLine = `To ${namesById[recipientId] || recipientId || "Recipient"}`;
  } else if (
    type === "receive" ||
    (type === "send" && isRecipient && !isSender) ||
    (isRecipient && !isSender)
  ) {
    label = "Received";
    direction = "incoming";
    partyLine = `From ${namesById[senderId] || senderId || "Sender"}`;
  } else if (isSelf) {
    label = "Funded";
    direction = "neutral";
    partyLine = "Internal transfer";
  }

  const sign = direction === "outgoing" ? "-" : direction === "incoming" ? "+" : "";
  return {
    id: txn.id,
    label,
    partyLine,
    whenLine: formatShortWhen(txn.created_at),
    amountLine: `${sign}$${formatMoney(amount)}`,
    amountTone: direction,
  };
}

export default function WalletPage() {
  const { user, loading, profile } = useUser();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [previewRows, setPreviewRows] = useState(null);
  const [withdrawalPreview, setWithdrawalPreview] = useState(null);

  const refreshWallet = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const raw = data?.wallet_balance ?? data?.balance ?? 0;
    setBalance(Number(raw) || 0);
  }, [user?.id]);

  const refreshPreview = useCallback(async () => {
    if (!user?.id) return;
    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!txns?.length) {
      setPreviewRows([]);
      return;
    }

    const otherIds = new Set();
    txns.forEach((t) => {
      if (t.sender_id && t.sender_id !== user.id) otherIds.add(t.sender_id);
      if (t.recipient_id && t.recipient_id !== user.id) otherIds.add(t.recipient_id);
    });

    const namesById = {
      [user.id]: profile?.full_name?.trim() || profile?.email?.trim() || "You",
    };

    if (otherIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...otherIds]);
      profs?.forEach((p) => {
        namesById[p.id] = displayNameFromProfile(p);
      });
    }

    setPreviewRows(txns.map((t) => classifyPreview(t, user.id, namesById)));
  }, [user?.id, profile?.email, profile?.full_name]);

  const refreshWithdrawalPreview = useCallback(async () => {
    if (!user?.id) {
      setWithdrawalPreview([]);
      return;
    }
    const { rows, error } = await fetchUserWithdrawalRequests(user.id, 3);
    if (error) {
      setWithdrawalPreview([]);
      return;
    }
    setWithdrawalPreview(rows);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refreshWallet();
    refreshPreview();
    void refreshWithdrawalPreview();
  }, [user?.id, refreshWallet, refreshPreview, refreshWithdrawalPreview]);

  if (loading) return null;

  return (
    <>
      <Navbar />
      <div style={pageShell}>
        <h1 style={pageTitle}>Wallet</h1>
        <SoftEnforcementNotice profile={profile} />

        <div style={balanceCard}>
          <p style={balanceLabel}>Available balance</p>
          <p style={balanceValue}>${formatMoney(balance)}</p>
        </div>

        <div style={actionsGrid}>
          {[
            { label: "Send Money", href: "/send", style: primaryAction },
            { label: "Fund Wallet", href: "/fund", style: successAction },
            { label: "Withdraw", href: "/withdraw", style: dangerAction },
            { label: "History", href: "/transactions", style: neutralAction },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              style={{ ...actionButton, ...item.style }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: "0.5rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <Link href="/insights" style={insightsLink}>
            Insights →
          </Link>
          <Link href="/support" style={insightsLink}>
            Help & support
          </Link>
        </div>

        <div style={withdrawalTeaserCard}>
          <div style={withdrawalTeaserHeader}>
            <h3 style={withdrawalTeaserTitle}>Withdrawal requests</h3>
            <Link href="/withdraw-wallet" style={withdrawalTeaserLink}>
              View / withdraw
            </Link>
          </div>
          {!withdrawalPreview ? (
            <p style={withdrawalTeaserMuted}>Loading…</p>
          ) : withdrawalPreview.length === 0 ? (
            <p style={withdrawalTeaserMuted}>No withdrawal requests yet.</p>
          ) : (
            <ul style={withdrawalTeaserList}>
              {withdrawalPreview.map((w, i) => (
                <li
                  key={w.id}
                  style={{
                    ...withdrawalTeaserRow,
                    borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                  }}
                >
                  <span style={withdrawalTeaserAmount}>${formatMoney(w?.amount)}</span>
                  <span style={withdrawalTeaserStatus}>{withdrawalStatusLabel(w?.status)}</span>
                  <span style={withdrawalTeaserWhen}>{formatShortWhen(w?.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={activityCard}>
          <div style={activityHeader}>
            <h3 style={activityTitle}>Recent Activity</h3>
            <Link href="/transactions" style={viewAllLink}>
              View all
            </Link>
          </div>

          {!previewRows ? (
            <p style={loadingText}>Loading activity...</p>
          ) : previewRows.length === 0 ? (
            <div style={emptyWrap}>
              <p style={emptyTitle}>No activity yet</p>
              <p style={emptySub}>Your recent wallet activity will appear here.</p>
            </div>
          ) : (
            previewRows.map((row, idx) => (
              <button
                key={row.id}
                type="button"
                onClick={() => router.push(`/transactions/${encodeURIComponent(String(row.id))}`)}
                style={{
                  ...activityRow,
                  borderBottom: idx === previewRows.length - 1 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={rowLabel}>{row.label}</p>
                  {row.partyLine ? <p style={rowParty}>{row.partyLine}</p> : null}
                  <p style={rowWhen}>{row.whenLine}</p>
                </div>
                <p
                  style={{
                    ...rowAmount,
                    color:
                      row.amountTone === "outgoing"
                        ? "#b91c1c"
                        : row.amountTone === "incoming"
                          ? "#047857"
                          : "#334155",
                  }}
                >
                  {row.amountLine}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

const pageShell = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "560px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  boxSizing: "border-box",
};

const pageTitle = {
  fontSize: "1.6rem",
  fontWeight: 700,
  color: "#f8fafc",
  margin: "0 0 0.75rem",
  letterSpacing: "-0.02em",
};

const balanceCard = {
  background: "linear-gradient(145deg, #1e293b 0%, #2563eb 40%, #0f172a 100%)",
  padding: "1.7rem 1.4rem",
  borderRadius: "16px",
  boxShadow: "0 16px 48px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(148, 197, 255, 0.22)",
  border: "1px solid rgba(148, 197, 255, 0.25)",
  marginBottom: "1rem",
};

const balanceLabel = {
  margin: 0,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const balanceValue = {
  margin: "0.5rem 0 0",
  fontSize: "2.5rem",
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#ffffff",
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
  textShadow: "0 1px 2px rgba(0,0,0,0.2)",
  wordBreak: "break-word",
};

const actionsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.65rem",
};

const actionButton = {
  width: "100%",
  padding: "0.82rem 0.75rem",
  borderRadius: "10px",
  color: "#fff",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
  border: "1px solid transparent",
};

const primaryAction = {
  borderColor: "rgba(59, 130, 246, 0.55)",
  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
};

const successAction = {
  borderColor: "rgba(16, 185, 129, 0.45)",
  background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
  boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
};

const dangerAction = {
  borderColor: "rgba(244, 114, 182, 0.45)",
  background: "linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)",
  boxShadow: "0 4px 14px rgba(225, 29, 72, 0.3)",
};

const neutralAction = {
  borderColor: "rgba(148, 163, 184, 0.55)",
  background: "linear-gradient(180deg, #475569 0%, #334155 100%)",
  boxShadow: "0 4px 12px rgba(30, 41, 59, 0.28)",
};

const insightsLink = {
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#7dd3fc",
  textDecoration: "none",
};

const withdrawalTeaserCard = {
  marginBottom: "1rem",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "14px",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  padding: "0.95rem 1rem",
};

const withdrawalTeaserHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginBottom: "0.65rem",
};

const withdrawalTeaserTitle = { margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" };
const withdrawalTeaserLink = { fontSize: "0.82rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" };
const withdrawalTeaserMuted = { margin: 0, fontSize: "0.85rem", color: "#64748b" };
const withdrawalTeaserList = { margin: 0, padding: 0, listStyle: "none" };
const withdrawalTeaserRow = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "0.35rem 0.75rem",
  padding: "0.45rem 0",
  fontSize: "0.84rem",
  color: "#334155",
};
const withdrawalTeaserAmount = { fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const withdrawalTeaserStatus = { fontWeight: 600, color: "#0369a1" };
const withdrawalTeaserWhen = { fontSize: "0.78rem", color: "#94a3b8", marginLeft: "auto" };

const activityCard = {
  marginTop: "0.75rem",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "14px",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  overflow: "hidden",
};

const activityHeader = {
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const activityTitle = { margin: 0, fontSize: "1rem", color: "#0f172a" };
const viewAllLink = { fontSize: "0.84rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" };
const loadingText = { margin: 0, padding: "1rem", color: "#64748b", fontSize: "0.9rem" };

const emptyWrap = { padding: "1rem" };
const emptyTitle = { margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" };
const emptySub = { margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#64748b" };

const activityRow = {
  width: "100%",
  textAlign: "left",
  padding: "0.9rem 1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.8rem",
  background: "#ffffff",
  border: "none",
  cursor: "pointer",
};

const rowLabel = { margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" };
const rowParty = {
  margin: "0.2rem 0 0",
  fontSize: "0.82rem",
  color: "#64748b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowWhen = { margin: "0.18rem 0 0", fontSize: "0.78rem", color: "#94a3b8" };
const rowAmount = { margin: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };