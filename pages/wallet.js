import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import { SoftEnforcementNotice } from "../lib/softEnforcement";

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

function enrichPreview(txn, userId, names) {
  const amt = Number(txn.amount);
  const amountNum = Number.isFinite(amt) ? amt : 0;
  const normalizedType = normalizeTransactionType(txn.type);

  const isSelfFund =
    txn.sender_id &&
    txn.recipient_id &&
    txn.sender_id === txn.recipient_id &&
    txn.recipient_id === userId &&
    normalizedType !== "withdraw";

  let directionLabel = "Activity";
  let sign = "+";
  let counterpartyLine = null;

  if (normalizedType === "withdraw") {
    directionLabel = "Withdrawn";
    sign = "−";
  } else if (normalizedType === "fund" || isSelfFund) {
    directionLabel = "Funded";
    sign = "+";
  } else if (normalizedType === "send") {
    if (txn.sender_id === userId && txn.recipient_id !== userId) {
      directionLabel = "Sent";
      sign = "−";
      counterpartyLine = names[txn.recipient_id] || null;
    } else if (txn.recipient_id === userId && txn.sender_id !== userId) {
      directionLabel = "Received";
      sign = "+";
      counterpartyLine = names[txn.sender_id] || null;
    }
  } else if (normalizedType === "receive") {
    directionLabel = "Received";
    sign = "+";
    if (txn.sender_id && txn.sender_id !== userId) {
      counterpartyLine = names[txn.sender_id] || null;
    }
  } else {
    if (txn.sender_id === userId && txn.recipient_id !== userId) {
      directionLabel = "Sent";
      sign = "−";
      counterpartyLine = names[txn.recipient_id] || null;
    } else if (txn.recipient_id === userId && txn.sender_id !== userId) {
      directionLabel = "Received";
      sign = "+";
      counterpartyLine = names[txn.sender_id] || null;
    } else if (isSelfFund) {
      directionLabel = "Funded";
      sign = "+";
    } else {
      directionLabel = normalizedType
        ? normalizedType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Activity";
    }
  }

  return {
    id: txn.id,
    directionLabel,
    amountLine: `${sign}$${formatMoney(amountNum)}`,
    amountIsOut: sign === "−",
    whenLine: formatShortWhen(txn.created_at),
    counterpartyLine,
  };
}

export default function WalletPage() {
  const { user, loading, profile } = useUser();
  const router = useRouter();

  const [balance, setBalance] = useState(0);
  const [previewRows, setPreviewRows] = useState(null);
  const [insights, setInsights] = useState(null);

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

    const names = { [user.id]: profile?.full_name || "You" };

    if (otherIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...otherIds]);

      profs?.forEach((p) => {
        names[p.id] = displayNameFromProfile(p);
      });
    }

    setPreviewRows(txns.map((t) => enrichPreview(t, user.id, names)));
  }, [user?.id, profile]);

  const refreshInsights = useCallback(async () => {
    if (!user?.id) return;

    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .gte("created_at", since);

    let sent = 0;
    let funded = 0;

    txns?.forEach((t) => {
      const type = normalizeTransactionType(t.type);
      const amount = Number(t.amount) || 0;

      const isSelfFund =
        t.sender_id &&
        t.recipient_id &&
        t.sender_id === t.recipient_id &&
        t.recipient_id === user.id &&
        type !== "withdraw";

      if (type === "send" && t.sender_id === user.id && t.recipient_id !== user.id) {
        sent += amount;
      }

      if (type === "fund" || isSelfFund) {
        funded += amount;
      }
    });

    setInsights({ sent, funded });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refreshWallet();
    refreshPreview();
    refreshInsights();
  }, [user?.id, refreshWallet, refreshPreview, refreshInsights]);

  if (loading) return null;

  return (
    <>
      <Navbar />
      <div
        style={{
          padding: "2rem 1.25rem 3rem",
          maxWidth: "520px",
          margin: "0 auto",
          minHeight: "calc(100vh - 3.5rem)",
          background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "1.55rem",
            fontWeight: 700,
            color: "#f8fafc",
            margin: "0 0 0.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          Wallet
        </h1>

        <SoftEnforcementNotice profile={profile} />

        <div
          style={{
            background:
              "linear-gradient(145deg, #1e293b 0%, #2563eb 35%, #1e3a5f 70%, #0f172a 100%)",
            padding: "1.6rem 1.5rem",
            borderRadius: "16px",
            marginBottom: "1.1rem",
            boxShadow:
              "0 16px 48px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(148, 197, 255, 0.22)",
            border: "1px solid rgba(148, 197, 255, 0.25)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Available balance
          </p>
          <p
            style={{
              margin: "0.45rem 0 0",
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            }}
          >
            ${formatMoney(balance)}
          </p>
        </div>

        {insights ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.65rem",
              marginBottom: "1.15rem",
            }}
          >
            <div
              style={{
                padding: "0.9rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                Sent (7d)
              </p>
              <p
                style={{
                  margin: "0.3rem 0 0",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${formatMoney(insights.sent)}
              </p>
            </div>
            <div
              style={{
                padding: "0.9rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                Funded (7d)
              </p>
              <p
                style={{
                  margin: "0.3rem 0 0",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${formatMoney(insights.funded)}
              </p>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0.65rem",
            marginBottom: "1.25rem",
          }}
        >
          <button
            onClick={() => router.push("/send-money")}
            style={{
              width: "100%",
              padding: "0.8rem",
              borderRadius: "10px",
              border: "1px solid rgba(59, 130, 246, 0.55)",
              background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.92rem",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
            }}
          >
            Send Money
          </button>
          <button
            onClick={() => router.push("/fund-wallet")}
            style={{
              width: "100%",
              padding: "0.8rem",
              borderRadius: "10px",
              border: "1px solid rgba(16, 185, 129, 0.45)",
              background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.92rem",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
            }}
          >
            Fund Wallet
          </button>
          <button
            onClick={() => router.push("/withdraw-wallet")}
            style={{
              width: "100%",
              padding: "0.8rem",
              borderRadius: "10px",
              border: "1px solid rgba(244, 114, 182, 0.45)",
              background: "linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.92rem",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(225, 29, 72, 0.3)",
            }}
          >
            Withdraw
          </button>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            borderRadius: "14px",
            boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.95rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Recent Activity</h3>
            <Link
              href="/transactions"
              style={{
                fontSize: "0.84rem",
                fontWeight: 600,
                color: "#2563eb",
                textDecoration: "none",
              }}
            >
              View all
            </Link>
          </div>

          {!previewRows ? (
            <p style={{ margin: 0, padding: "1rem", color: "#64748b", fontSize: "0.9rem" }}>
              Loading activity…
            </p>
          ) : previewRows.length === 0 ? (
            <p style={{ margin: 0, padding: "1rem", color: "#64748b", fontSize: "0.9rem" }}>
              No activity yet.
            </p>
          ) : (
            previewRows.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  padding: "0.9rem 1rem",
                  borderBottom: idx === previewRows.length - 1 ? "none" : "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.8rem",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>
                    {row.directionLabel}
                  </p>
                  {row.counterpartyLine ? (
                    <p
                      style={{
                        margin: "0.2rem 0 0",
                        fontSize: "0.82rem",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {row.directionLabel === "Sent" && "To "}
                      {row.directionLabel === "Received" && "From "}
                      {row.counterpartyLine}
                    </p>
                  ) : null}
                  <p style={{ margin: "0.18rem 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
                    {row.whenLine}
                  </p>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: row.amountIsOut ? "#b91c1c" : "#047857",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.amountLine}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}