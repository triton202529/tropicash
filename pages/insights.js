import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

function formatMoney(value) {
  const amount = Number(value);
  return Number(Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeType(type) {
  const raw = String(type || "").toLowerCase();
  if (raw === "send_money") return "send";
  if (raw === "receive_money") return "receive";
  if (raw === "fund_wallet") return "fund";
  if (raw === "withdraw_wallet") return "withdraw";
  return raw;
}

function classifyTransaction(txn, currentUserId) {
  const normalizedType = normalizeType(txn.type);
  const amount = Number(txn.amount) || 0;
  const senderId = txn.sender_id || null;
  const recipientId = txn.recipient_id || null;
  const isSender = senderId === currentUserId;
  const isRecipient = recipientId === currentUserId;
  const isSelf = senderId && recipientId && senderId === currentUserId && recipientId === currentUserId;

  let direction = "neutral";

  if (normalizedType === "withdraw") {
    direction = "outgoing";
  } else if (normalizedType === "fund") {
    direction = "incoming";
  } else if ((normalizedType === "send" && isSender && !isRecipient) || (isSender && !isRecipient)) {
    direction = "outgoing";
  } else if (
    normalizedType === "receive" ||
    (normalizedType === "send" && isRecipient && !isSender) ||
    (isRecipient && !isSender)
  ) {
    direction = "incoming";
  } else if (isSelf) {
    direction = "neutral";
  }

  return {
    ...txn,
    direction,
    amountValue: amount,
  };
}

function calculateTotals(enrichedTransactions) {
  let totalSpent = 0;
  let totalReceived = 0;
  (enrichedTransactions || []).forEach((txn) => {
    if (txn.direction === "outgoing") totalSpent += txn.amountValue;
    if (txn.direction === "incoming") totalReceived += txn.amountValue;
  });
  return {
    totalSpent,
    totalReceived,
    netFlow: totalReceived - totalSpent,
  };
}

export default function InsightsPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      const { data: txns, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[insights] fetch failed:", error);
        setRows([]);
        setErrorMsg("Could not load insights right now.");
        setLoading(false);
        return;
      }

      setRows(txns || []);
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, profile?.email, profile?.full_name]);

  const enriched = useMemo(() => {
    if (!user?.id) return [];
    return rows.map((txn) => classifyTransaction(txn, user.id));
  }, [rows, user?.id]);

  const totals = useMemo(() => calculateTotals(enriched), [enriched]);

  if (!authLoading && !user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={pageTitle}>Insights</h1>
          <p style={subtleText}>Sign in to view your activity insights.</p>
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
      <div style={pageShell}>
        <div style={headerRow}>
          <div>
            <h1 style={pageTitle}>Insights</h1>
            <p style={subtleText}>Read-only totals from your transactions.</p>
          </div>
          <Link href="/wallet" style={backLink}>
            Back to Wallet
          </Link>
        </div>

        {authLoading || loading ? (
          <div style={stateCard}>
            <p style={stateTitle}>Loading insights...</p>
          </div>
        ) : errorMsg ? (
          <div style={stateCard}>
            <p style={stateTitle}>{errorMsg}</p>
          </div>
        ) : rows.length === 0 ? (
          <div style={stateCard}>
            <p style={stateTitle}>No activity yet</p>
            <p style={stateDescription}>Start sending or funding your wallet to see totals here.</p>
          </div>
        ) : (
          <div style={cardsGrid}>
            <div style={card}>
              <p style={cardLabel}>Total Spent</p>
              <p style={{ ...cardValue, color: "#dc2626" }}>-${formatMoney(totals.totalSpent)}</p>
            </div>
            <div style={card}>
              <p style={cardLabel}>Total Received</p>
              <p style={{ ...cardValue, color: "#059669" }}>+${formatMoney(totals.totalReceived)}</p>
            </div>
            <div style={card}>
              <p style={cardLabel}>Net Flow</p>
              <p style={{ ...cardValue, color: totals.netFlow >= 0 ? "#059669" : "#dc2626" }}>
                {totals.netFlow >= 0 ? "+" : "-"}${formatMoney(Math.abs(totals.netFlow))}
              </p>
            </div>
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
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  boxSizing: "border-box",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const pageTitle = { margin: 0, color: "#f8fafc", fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em" };
const subtleText = { margin: "0.45rem 0 0", color: "#94a3b8", fontSize: "0.92rem" };
const backLink = {
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

const cardsGrid = {
  marginTop: "1rem",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.65rem",
};

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#ffffff",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  padding: "0.7rem 0.72rem",
  minWidth: 0,
};

const cardLabel = {
  margin: 0,
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
  color: "#64748b",
};

const cardValue = {
  margin: "0.32rem 0 0",
  fontSize: "1.06rem",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

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
const linkBtn = { display: "inline-block", marginTop: "0.9rem", color: "#0ea5e9", fontWeight: 600, textDecoration: "none" };
