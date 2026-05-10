import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import SoftLaunchNotice from "../components/SoftLaunchNotice";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import {
  fetchUserWithdrawalRequests,
  formatWithdrawalFailureForUser,
  withdrawalStatusBadgeStyle,
  withdrawalStatusUserLine,
} from "../lib/withdrawalRequests";
import {
  formatPayPalEnvironmentBadge,
  fundingMethodLabel,
  getPayPalAppEnvironment,
  resolveFundingMethodForTransaction,
} from "../lib/paymentSource";

const pillLinkClass =
  "inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#0369a1] shadow-sm backdrop-blur-sm transition hover:bg-slate-50 sm:text-sm";

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

function formatWithdrawalDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  let envBadge = null;

  if (type === "withdraw") {
    label = "Withdrawal";
    direction = "outgoing";
    partyLine = "PayPal payout";
  } else if (type === "fund") {
    label = "Funding";
    direction = "incoming";
    const method = resolveFundingMethodForTransaction(txn);
    partyLine = fundingMethodLabel(method);
    envBadge = formatPayPalEnvironmentBadge(getPayPalAppEnvironment());
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
    envBadge,
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
    const { rows, error } = await fetchUserWithdrawalRequests(user.id, 5);
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

  const actionItems = [
    {
      label: "Send Money",
      href: "/send",
      className:
        "border border-blue-400/40 bg-gradient-to-b from-blue-500 to-blue-600 text-center text-sm font-bold tracking-tight text-white shadow-md shadow-blue-500/25",
    },
    {
      label: "Fund Wallet",
      href: "/fund",
      className:
        "border border-emerald-400/35 bg-gradient-to-b from-emerald-500 to-emerald-600 text-center text-sm font-bold tracking-tight text-white shadow-md shadow-emerald-500/20",
    },
    {
      label: "Withdraw",
      href: "/withdraw",
      className:
        "border border-rose-400/40 bg-gradient-to-b from-rose-500 to-rose-600 text-center text-sm font-bold tracking-tight text-white shadow-md shadow-rose-500/25",
    },
    {
      label: "History",
      href: "/transactions",
      className: "text-center text-sm font-bold tracking-tight text-[#0f172a] shadow-sm sm:text-[0.95rem]",
    },
  ];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .wallet-dash-action { transition: all 0.2s ease; }
            .wallet-dash-action:hover { transform: translateY(-2px); filter: brightness(1.05); }
            .wallet-dash-action:active { transform: scale(0.98); }
            .wallet-dash-action--history {
              background: #fff !important;
              border: 1px solid #e2e8f0 !important;
              color: #0f172a !important;
            }
          `,
        }}
      />
      <Navbar />
      <div
        className="mx-auto box-border w-full max-w-[720px] overflow-x-hidden bg-transparent px-4 pb-12 pt-6 sm:px-8 sm:pb-14 sm:pt-10"
        style={pageShell}
      >
        <header style={headerBlock}>
          <h1 style={pageTitle}>Wallet</h1>
          <p style={pageSubtitle}>Manage your Tropicash balance, transfers, and withdrawals.</p>
        </header>

        <div className="mb-4">
          <SoftEnforcementNotice profile={profile} />
        </div>

        <div className="mb-5">
          <SoftLaunchNotice />
        </div>

        <div style={balanceCard}>
          <p style={balanceLabel}>Available balance</p>
          <p style={balanceValue}>${formatMoney(balance)}</p>
          <p style={balanceHint}>Ready to send, withdraw, or fund.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
          {actionItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              className={`wallet-dash-action min-h-[48px] w-full rounded-2xl px-3 py-3.5 text-center sm:text-[0.95rem] ${
                item.label === "History" ? "wallet-dash-action--history" : ""
              } ${item.className}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <nav
          className="mb-6 mt-5 flex flex-wrap gap-2 sm:gap-2.5"
          aria-label="Wallet shortcuts"
        >
          <Link href="/insights" className={pillLinkClass}>
            Insights <span aria-hidden="true">→</span>
          </Link>
          <Link href="/support" className={pillLinkClass}>
            Help &amp; support <span aria-hidden="true">→</span>
          </Link>
          <Link href="/security" className={pillLinkClass}>
            Security Center <span aria-hidden="true">→</span>
          </Link>
          <Link href="/privacy" className={pillLinkClass}>
            Privacy <span aria-hidden="true">→</span>
          </Link>
          <Link href="/terms" className={pillLinkClass}>
            Terms <span aria-hidden="true">→</span>
          </Link>
        </nav>

        <div
          className="tropicash-surface mb-5 rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
          style={walletCardShadow}
        >
          <div style={withdrawalTeaserHeader}>
            <h3 style={withdrawalTeaserTitle}>Withdrawal requests</h3>
            <Link href="/withdraw-wallet" style={withdrawalTeaserLink}>
              View / withdraw
            </Link>
          </div>
          {!withdrawalPreview ? (
            <p style={withdrawalTeaserLoading}>Loading…</p>
          ) : withdrawalPreview.length === 0 ? (
            <p style={withdrawalTeaserMuted}>No withdrawal requests yet.</p>
          ) : (
            <ul style={withdrawalTeaserList}>
              {withdrawalPreview.map((w, i) => {
                const st = String(w?.status || "").toLowerCase();
                const payoutTo = String(w?.payout_email || w?.payout_destination || "").trim();
                const methodLabel = String(w?.payout_label || "").trim() || "—";
                const failUser = st === "failed" ? formatWithdrawalFailureForUser(w?.failure_reason) : "";
                return (
                  <li
                    key={w.id}
                    style={{
                      ...withdrawalCard,
                      marginTop: i === 0 ? 0 : "0.75rem",
                      borderTop: i === 0 ? "none" : undefined,
                      paddingTop: i === 0 ? "0.15rem" : "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem 0.75rem",
                        marginBottom: "0.65rem",
                      }}
                    >
                      <span style={withdrawalTeaserAmount}>${formatMoney(w?.amount)}</span>
                      <span style={withdrawalStatusBadgeStyle(w?.status)}>{withdrawalStatusUserLine(w?.status)}</span>
                    </div>
                    <div style={withdrawalMetaBlock}>
                      <p style={withdrawalMetaLine}>
                        <span style={withdrawalMetaKey}>Payout method</span>
                        <span style={withdrawalMetaVal}>{methodLabel}</span>
                      </p>
                      {payoutTo ? (
                        <p style={withdrawalMetaLine}>
                          <span style={withdrawalMetaKey}>Destination</span>
                          <span style={{ ...withdrawalMetaVal, wordBreak: "break-all" }}>{payoutTo}</span>
                        </p>
                      ) : null}
                      <p style={withdrawalMetaLine}>
                        <span style={withdrawalMetaKey}>Created</span>
                        <span style={withdrawalMetaVal}>{formatWithdrawalDateTime(w?.created_at)}</span>
                      </p>
                      {w?.paid_at ? (
                        <p style={withdrawalMetaLine}>
                          <span style={withdrawalMetaKey}>Paid</span>
                          <span style={withdrawalMetaVal}>{formatWithdrawalDateTime(w.paid_at)}</span>
                        </p>
                      ) : null}
                      {failUser ? (
                        <p style={withdrawalFailLine}>
                          <span style={withdrawalMetaKey}>Details</span>
                          <span style={{ display: "block", marginTop: "0.25rem", wordBreak: "break-word" }}>{failUser}</span>
                        </p>
                      ) : null}
                    </div>
                    <p style={withdrawalRelativeWhen}>{formatShortWhen(w?.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="tropicash-surface rounded-2xl pb-1 pt-0" style={walletCardShadow}>
          <div style={activityHeader}>
            <h3 style={activityTitle}>Recent Activity</h3>
            <Link href="/transactions" style={viewAllLink}>
              View all
            </Link>
          </div>

          {!previewRows ? (
            <p style={loadingText}>Loading activity…</p>
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
                className={`flex w-full cursor-pointer items-center justify-between gap-3 bg-transparent px-4 py-3.5 text-left transition hover:bg-slate-50/90 sm:px-5 ${
                  idx === previewRows.length - 1 ? "border-b-0" : "border-b border-slate-100"
                }`}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={rowLabel}>{row.label}</p>
                  {row.partyLine ? (
                    <p style={rowParty}>
                      {row.partyLine}
                      {row.envBadge ? (
                        <span style={rowEnvBadge}>{row.envBadge}</span>
                      ) : null}
                    </p>
                  ) : null}
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
  minHeight: "calc(100vh - 4rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const headerBlock = {
  marginBottom: "1.75rem",
};

const walletCardShadow = {
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
};

const pageTitle = {
  fontSize: "clamp(1.5rem, 4vw, 1.85rem)",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 0.35rem",
  letterSpacing: "-0.03em",
  lineHeight: 1.15,
};

const pageSubtitle = {
  margin: 0,
  fontSize: "0.9rem",
  lineHeight: 1.5,
  color: "#64748b",
  maxWidth: "36rem",
};

const balanceCard = {
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 42%, #0f766e 100%)",
  padding: "24px",
  borderRadius: "24px",
  boxShadow: "0 20px 50px rgba(37, 99, 235, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  marginBottom: "1.25rem",
};

const balanceLabel = {
  margin: 0,
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.82)",
};

const balanceValue = {
  margin: "0.4rem 0 0",
  fontSize: "clamp(2rem, 8vw, 2.65rem)",
  lineHeight: 1.05,
  fontWeight: 800,
  color: "#ffffff",
  letterSpacing: "-0.03em",
  fontVariantNumeric: "tabular-nums",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
  wordBreak: "break-word",
};

const balanceHint = {
  margin: "0.65rem 0 0",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "rgba(255, 255, 255, 0.88)",
  lineHeight: 1.45,
};

const withdrawalTeaserHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  marginBottom: "0.75rem",
};

const withdrawalTeaserTitle = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 700,
  color: "#0f172a",
  letterSpacing: "-0.02em",
};
const withdrawalTeaserLink = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#0369a1",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const withdrawalTeaserMuted = { margin: 0, fontSize: "0.875rem", color: "#64748b", lineHeight: 1.5 };
const withdrawalTeaserLoading = {
  margin: 0,
  padding: "1.75rem 0.5rem",
  textAlign: "center",
  fontSize: "0.9rem",
  color: "#64748b",
};
const withdrawalTeaserList = { margin: 0, padding: 0, listStyle: "none", maxWidth: "100%" };
const withdrawalCard = {
  listStyle: "none",
  maxWidth: "100%",
  boxSizing: "border-box",
};
const withdrawalTeaserAmount = { fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: "1.05rem", color: "#0f172a" };
const withdrawalMetaBlock = { margin: 0, padding: 0 };
const withdrawalMetaLine = {
  margin: "0 0 0.4rem",
  fontSize: "0.82rem",
  color: "#475569",
  lineHeight: 1.45,
  display: "grid",
  gridTemplateColumns: "minmax(0, 7.5rem) minmax(0, 1fr)",
  gap: "0.35rem 0.65rem",
  alignItems: "start",
};
const withdrawalMetaKey = { fontWeight: 600, color: "#64748b" };
const withdrawalMetaVal = { fontWeight: 500, color: "#0f172a", minWidth: 0 };
const withdrawalFailLine = {
  margin: "0.35rem 0 0",
  fontSize: "0.8rem",
  color: "#b91c1c",
  lineHeight: 1.45,
};
const withdrawalRelativeWhen = { margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#94a3b8" };

const activityHeader = {
  padding: "1rem 1.25rem 0.9rem",
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const activityTitle = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 700,
  color: "#0f172a",
  letterSpacing: "-0.02em",
};
const viewAllLink = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#0369a1",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const loadingText = {
  margin: 0,
  padding: "2rem 1.25rem",
  textAlign: "center",
  color: "#64748b",
  fontSize: "0.9rem",
};

const emptyWrap = { padding: "1.75rem 1.25rem 2rem", textAlign: "center" };
const emptyTitle = { margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#475569" };
const emptySub = { margin: "0.4rem 0 0", fontSize: "0.875rem", color: "#94a3b8", lineHeight: 1.5 };

const rowLabel = { margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" };
const rowParty = {
  margin: "0.2rem 0 0",
  fontSize: "0.82rem",
  color: "#64748b",
  whiteSpace: "normal",
  overflow: "hidden",
  wordBreak: "break-word",
};
const rowEnvBadge = {
  display: "inline-block",
  marginLeft: "0.45rem",
  padding: "0.12rem 0.42rem",
  borderRadius: "999px",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  verticalAlign: "middle",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #e2e8f0",
};
const rowWhen = { margin: "0.18rem 0 0", fontSize: "0.78rem", color: "#94a3b8" };
const rowAmount = { margin: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };