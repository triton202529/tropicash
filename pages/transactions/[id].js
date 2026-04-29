import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";

function formatMoney(value) {
  const amount = Number(value);
  return Number(Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "medium",
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

function transactionMethod(txn) {
  const norm = normalizeType(txn.type);
  if (norm === "fund" && isPayPalFundContext(txn)) return "PayPal Sandbox";
  if (norm === "fund") return "Wallet";
  if (norm === "send" || norm === "receive") return "Wallet Transfer";
  if (norm === "withdraw") return "Wallet Withdrawal";
  return "Wallet";
}

function displayName(profileRow, fallbackId) {
  if (!profileRow) return fallbackId || "—";
  return profileRow.full_name?.trim() || profileRow.email?.trim() || fallbackId || "—";
}

function classifyDetail(txn, userId, namesById) {
  const normalized = normalizeType(txn.type);
  const senderId = txn.sender_id || null;
  const recipientId = txn.recipient_id || null;
  const isSender = senderId === userId;
  const isRecipient = recipientId === userId;
  const isSelf = senderId && recipientId && senderId === userId && recipientId === userId;

  let label = "Transaction";
  let direction = "neutral";
  let senderName = senderId ? namesById[senderId] || senderId : "—";
  let recipientName = recipientId ? namesById[recipientId] || recipientId : "—";

  if (normalized === "withdraw") {
    label = "Withdrawn";
    direction = "outgoing";
    senderName = "You";
    recipientName = "Bank / External";
  } else if (normalized === "fund") {
    label = fundingRowLabel(txn);
    direction = "incoming";
    senderName = "PayPal Sandbox";
    recipientName = "You";
  } else if ((normalized === "send" && isSender && !isRecipient) || (isSender && !isRecipient)) {
    label = "Sent";
    direction = "outgoing";
    senderName = "You";
    recipientName = namesById[recipientId] || recipientId || "Recipient";
  } else if (
    normalized === "receive" ||
    (normalized === "send" && isRecipient && !isSender) ||
    (isRecipient && !isSender)
  ) {
    label = "Received";
    direction = "incoming";
    senderName = namesById[senderId] || senderId || "Sender";
    recipientName = "You";
  } else if (isSelf) {
    label = fundingRowLabel(txn);
    direction = "neutral";
    senderName = "You";
    recipientName = "You";
  }

  const amount = Number(txn.amount) || 0;
  const sign = direction === "outgoing" ? "-" : direction === "incoming" ? "+" : "";
  const color = direction === "outgoing" ? "#dc2626" : direction === "incoming" ? "#059669" : "#334155";

  return {
    label,
    method: transactionMethod(txn),
    senderName: senderName === userId ? "You" : senderName,
    recipientName: recipientName === userId ? "You" : recipientName,
    amountLine: `${sign}$${formatMoney(amount)}`,
    amountColor: color,
  };
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const rawId = router.query?.id;
  const transactionId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [nameMap, setNameMap] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!router.isReady || authLoading) return;

    if (!user?.id) {
      setLoading(false);
      setErrorMsg("Sign in to view transaction details.");
      return;
    }

    if (!transactionId || typeof transactionId !== "string") {
      setLoading(false);
      setErrorMsg("Invalid transaction ID.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data: txn, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .maybeSingle();

      if (cancelled) return;

      if (txError) {
        console.error("[transactions/id] fetch failed:", txError);
        setTransaction(null);
        setErrorMsg("Could not load this transaction.");
        setLoading(false);
        return;
      }

      if (!txn) {
        setTransaction(null);
        setErrorMsg("Transaction not found.");
        setLoading(false);
        return;
      }

      if (txn.sender_id !== user.id && txn.recipient_id !== user.id) {
        setTransaction(null);
        setErrorMsg("You do not have access to this transaction.");
        setLoading(false);
        return;
      }

      setTransaction(txn);

      const profileIds = [txn.sender_id, txn.recipient_id].filter(Boolean);
      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);

        if (cancelled) return;
        if (profileError) {
          console.error("[transactions/id] profile fetch failed:", profileError);
          setNameMap({});
        } else {
          const byId = {};
          (profileRows || []).forEach((row) => {
            byId[row.id] = displayName(row, row.id);
          });
          setNameMap(byId);
        }
      } else {
        setNameMap({});
      }

      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, router.isReady, transactionId, user?.id]);

  const detail = useMemo(() => {
    if (!transaction || !user?.id) {
      return {
        label: "Transaction",
        method: "Wallet",
        senderName: "—",
        recipientName: "—",
        amountLine: "$0.00",
        amountColor: "#334155",
      };
    }
    return classifyDetail(transaction, user.id, nameMap);
  }, [transaction, user?.id, nameMap]);

  const handleCopyTxId = async () => {
    if (!transaction?.id) return;
    try {
      await navigator.clipboard.writeText(String(transaction.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error("[transactions/id] clipboard failed:", error);
    }
  };

  if (!authLoading && !user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <div style={card}>
            <p style={stateTitle}>Sign in to view this transaction.</p>
            <Link href="/login" style={linkBtn}>
              Go to login
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageShell}>
        {authLoading || loading ? (
          <div style={card}>
            <p style={stateTitle}>Loading transaction details...</p>
          </div>
        ) : errorMsg || !transaction ? (
          <div style={card}>
            <p style={stateTitle}>{errorMsg || "Transaction not found."}</p>
            <button type="button" onClick={() => router.push("/transactions")} style={backBtn}>
              Back to history
            </button>
          </div>
        ) : (
          <div style={card}>
            <p style={eyebrow}>Transaction Detail</p>
            <h1 style={title}>{detail.label}</h1>
            <p style={{ ...amountText, color: detail.amountColor }}>{detail.amountLine}</p>

            <div style={sectionDivider} />

            <p style={sectionHeading}>Overview</p>
            <div style={metaGrid}>
              <DetailRow label="Type" value={detail.label} />
              <DetailRow label="Method" value={detail.method} />
              <DetailRow label="Date & time" value={formatDateTime(transaction.created_at)} />
              <DetailRow label="Status" value={transaction.status || "completed"} />
            </div>

            <div style={sectionDivider} />
            <p style={sectionHeading}>Parties</p>
            <div style={metaGrid}>
              <DetailRow label="Sender" value={detail.senderName || "—"} />
              <DetailRow label="Recipient" value={detail.recipientName || "—"} />
            </div>

            <div style={sectionDivider} />
            <p style={sectionHeading}>Reference</p>
            <div style={metaGrid}>
              <DetailRow
                label="Transaction ID"
                value={String(transaction.id)}
                mono
                extraAction={
                  <button type="button" style={copyBtn} onClick={handleCopyTxId}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                }
              />
            </div>

            <button type="button" onClick={() => router.push("/transactions")} style={backBtn}>
              Back to history
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value, mono = false, extraAction = null }) {
  return (
    <div style={detailRow}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
        <p style={detailLabel}>{label}</p>
        {extraAction}
      </div>
      <p style={mono ? detailValueMono : detailValue}>{value || "—"}</p>
    </div>
  );
}

const pageShell = {
  minHeight: "calc(100vh - 3.5rem)",
  padding: "2rem 1.25rem 3rem",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
};

const card = {
  width: "100%",
  maxWidth: "620px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
  padding: "1.35rem 1.15rem",
};

const eyebrow = {
  margin: 0,
  fontSize: "0.74rem",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#94a3b8",
  fontWeight: 700,
};

const title = {
  margin: "0.4rem 0 0",
  color: "#0f172a",
  fontSize: "1.3rem",
  fontWeight: 700,
};

const amountText = {
  margin: "0.8rem 0 0",
  fontSize: "2.5rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
};

const metaGrid = {
  marginTop: "1rem",
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "0.65rem",
};

const detailRow = {
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
  borderRadius: "10px",
  padding: "0.72rem 0.78rem",
};

const detailLabel = {
  margin: 0,
  color: "#64748b",
  fontSize: "0.73rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const detailValue = {
  margin: "0.2rem 0 0",
  color: "#0f172a",
  fontSize: "0.95rem",
  fontWeight: 600,
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const detailValueMono = {
  ...detailValue,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.82rem",
};

const stateTitle = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 700,
};

const sectionHeading = {
  margin: "0.2rem 0 0.6rem",
  color: "#475569",
  fontSize: "0.74rem",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  fontWeight: 700,
};

const sectionDivider = {
  marginTop: "1rem",
  marginBottom: "0.6rem",
  height: "1px",
  background: "#e2e8f0",
};

const copyBtn = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "8px",
  padding: "0.25rem 0.5rem",
  fontWeight: 700,
  fontSize: "0.72rem",
  cursor: "pointer",
};

const backBtn = {
  marginTop: "1rem",
  border: "1px solid rgba(59, 130, 246, 0.6)",
  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "0.6rem 0.92rem",
  fontWeight: 700,
  fontSize: "0.86rem",
  cursor: "pointer",
};

const linkBtn = {
  display: "inline-block",
  marginTop: "0.9rem",
  color: "#0ea5e9",
  fontWeight: 600,
  textDecoration: "none",
};
