import { useEffect, useMemo, useState, isValidElement } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import {
  findWithdrawalMatchForWithdrawTransaction,
  formatWithdrawalFailureForUser,
  withdrawalStatusBadgeStyle,
  withdrawalStatusUserLine,
} from "../../lib/withdrawalRequests";
import {
  formatPayPalEnvironmentBadge,
  fundingMethodLabel,
  getPayPalAppEnvironment,
  resolveFundingMethodForTransaction,
} from "../../lib/paymentSource";

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

function fundingRowLabel() {
  return "Funded";
}

function transactionMethod(txn) {
  const norm = normalizeType(txn.type);
  if (norm === "fund" && isPayPalFundContext(txn)) {
    return fundingMethodLabel(resolveFundingMethodForTransaction(txn));
  }
  if (norm === "fund") return "Wallet";
  if (norm === "send" || norm === "receive") return "Wallet Transfer";
  if (norm === "withdraw") return "PayPal payout";
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
    label = "Withdrawal";
    direction = "outgoing";
    senderName = "You";
    recipientName = "PayPal";
  } else if (normalized === "fund") {
    label = fundingRowLabel();
    direction = "incoming";
    senderName = isPayPalFundContext(txn)
      ? fundingMethodLabel(resolveFundingMethodForTransaction(txn))
      : "Wallet funding";
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
    label = fundingRowLabel();
    direction = "neutral";
    senderName = "You";
    recipientName = "You";
  }

  const amount = Number(txn.amount) || 0;
  const sign = direction === "outgoing" ? "-" : direction === "incoming" ? "+" : "";
  const color = direction === "outgoing" ? "#dc2626" : direction === "incoming" ? "#059669" : "#334155";

  const payPalFund = normalized === "fund" && isPayPalFundContext(txn);
  const fundingEnvironmentBadge = payPalFund
    ? formatPayPalEnvironmentBadge(getPayPalAppEnvironment())
    : null;

  return {
    label,
    method: transactionMethod(txn),
    fundingEnvironmentBadge,
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
  const [withdrawalRows, setWithdrawalRows] = useState([]);
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
      setWithdrawalRows([]);

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

      const normType = normalizeType(txn.type);
      if (normType === "withdraw") {
        const { data: wrData } = await supabase
          .from("withdrawal_requests")
          .select("id, user_id, amount, payout_email, payout_destination, status, paid_at, failure_reason, created_at, external_reference")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(80);
        if (!cancelled) setWithdrawalRows(Array.isArray(wrData) ? wrData : []);
      } else if (!cancelled) {
        setWithdrawalRows([]);
      }

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
        fundingEnvironmentBadge: null,
        senderName: "—",
        recipientName: "—",
        amountLine: "$0.00",
        amountColor: "#334155",
      };
    }
    return classifyDetail(transaction, user.id, nameMap);
  }, [transaction, user?.id, nameMap]);

  const withdrawalMatch = useMemo(() => {
    if (!transaction || !user?.id) return null;
    return findWithdrawalMatchForWithdrawTransaction(transaction, withdrawalRows, user.id);
  }, [transaction, withdrawalRows, user?.id]);

  const isWithdrawDetail = transaction && normalizeType(transaction.type) === "withdraw";

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
          <div className="tropicash-surface" style={card}>
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
          <div className="tropicash-surface" style={card}>
            <p style={stateTitle}>Loading transaction details...</p>
          </div>
        ) : errorMsg || !transaction ? (
          <div className="tropicash-surface" style={card}>
            <p style={stateTitle}>{errorMsg || "Transaction not found."}</p>
            <button type="button" onClick={() => router.push("/transactions")} style={backBtn}>
              Back to history
            </button>
          </div>
        ) : (
          <div className="tropicash-surface" style={card}>
            <p style={eyebrow}>Transaction Detail</p>
            <h1 style={title}>{detail.label}</h1>
            <p style={{ ...amountText, color: detail.amountColor }}>{detail.amountLine}</p>

            <div style={sectionDivider} />

            <p style={sectionHeading}>Overview</p>
            <div style={metaGrid}>
              <DetailRow label="Type" value={detail.label} />
              <DetailRow label="Method" value={detail.method} />
              {detail.fundingEnvironmentBadge ? (
                <DetailRow
                  label="Environment"
                  value={<span style={fundingEnvBadgeDetail}>{detail.fundingEnvironmentBadge}</span>}
                />
              ) : null}
              <DetailRow label="Date & time" value={formatDateTime(transaction.created_at)} />
              <DetailRow label="Status" value={transaction.status || "completed"} />
            </div>

            <div style={sectionDivider} />
            <p style={sectionHeading}>Parties</p>
            <div style={metaGrid}>
              <DetailRow label="Sender" value={detail.senderName || "—"} />
              <DetailRow label="Recipient" value={detail.recipientName || "—"} />
            </div>

            {isWithdrawDetail ? (
              <>
                <div style={sectionDivider} />
                <p style={sectionHeading}>Payout status</p>
                <WithdrawalLifecycle withdrawal={withdrawalMatch} />
              </>
            ) : null}

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

function WithdrawalLifecycle({ withdrawal }) {
  if (!withdrawal) {
    return (
      <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b", lineHeight: 1.5 }}>
        Withdrawal request details will appear here when linked to your payout queue. Amount and date already match your
        wallet debit.
      </p>
    );
  }
  const st = String(withdrawal.status || "").toLowerCase();
  const payoutEmail = String(withdrawal.payout_email || withdrawal.payout_destination || "").trim();
  const failText = st === "failed" ? formatWithdrawalFailureForUser(withdrawal.failure_reason) : "";
  const rejectText =
    st === "rejected"
      ? String(withdrawal.rejection_reason || withdrawal.admin_note || "").trim()
      : "";

  const steps = [
    { key: "requested", label: "Requested", done: true },
    { key: "processing", label: "Processing", done: st === "processing" || st === "paid" || st === "failed" || st === "rejected" },
    { key: "paid", label: "Paid", done: st === "paid" },
    { key: "closed", label: "Failed or rejected", done: st === "failed" || st === "rejected" },
  ];

  return (
    <div style={{ maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={withdrawalStatusBadgeStyle(withdrawal.status)}>{withdrawalStatusUserLine(withdrawal.status)}</span>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
        {steps.map((s) => (
          <li
            key={s.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              fontSize: "0.88rem",
              color: s.done ? "#0f172a" : "#94a3b8",
              fontWeight: s.done ? 600 : 500,
            }}
          >
            <span style={{ flex: "0 0 auto", width: "1.1rem" }}>{s.done ? "✓" : "○"}</span>
            <span style={{ minWidth: 0 }}>{s.label}</span>
          </li>
        ))}
      </ol>
      {st === "paid" ? (
        <div style={{ marginTop: "1rem", padding: "0.75rem 0.85rem", borderRadius: "10px", border: "1px solid #a7f3d0", background: "#ecfdf5" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#047857" }}>Payout marked paid</p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#166534", lineHeight: 1.45 }}>
            Tropicash recorded this payout as complete. If you do not see the funds yet, check the account or method you
            provided for withdrawals.
          </p>
          {withdrawal.paid_at ? (
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "#166534" }}>Marked paid {formatDateTime(withdrawal.paid_at)}</p>
          ) : null}
          {withdrawal.paid_via ? (
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#15803d" }}>Paid via: {String(withdrawal.paid_via)}</p>
          ) : null}
          {withdrawal.external_reference ? (
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#15803d", wordBreak: "break-all" }}>
              Reference: {String(withdrawal.external_reference)}
            </p>
          ) : null}
        </div>
      ) : null}
      {payoutEmail ? (
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.84rem", color: "#475569", wordBreak: "break-all" }}>
          Payout destination on file: <strong style={{ fontWeight: 600 }}>{payoutEmail}</strong>
        </p>
      ) : null}
      {(st === "failed" && failText) || (st === "rejected" && rejectText) ? (
        <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.85rem", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2" }}>
          <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {st === "rejected" ? "Rejection" : "Failure details"}
          </p>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.84rem", color: "#7f1d1d", lineHeight: 1.45, wordBreak: "break-word" }}>
            {st === "failed" ? failText : rejectText}
          </p>
        </div>
      ) : st === "rejected" && !rejectText ? (
        <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.85rem", borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2" }}>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "#7f1d1d", lineHeight: 1.45 }}>This withdrawal was rejected. Contact support if you need more detail.</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, mono = false, extraAction = null }) {
  const body =
    value == null || value === "" ? (
      <p style={mono ? detailValueMono : detailValue}>—</p>
    ) : isValidElement(value) ? (
      <div style={{ margin: "0.2rem 0 0" }}>{value}</div>
    ) : (
      <p style={mono ? detailValueMono : detailValue}>{String(value)}</p>
    );

  return (
    <div style={detailRow}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
        <p style={detailLabel}>{label}</p>
        {extraAction}
      </div>
      {body}
    </div>
  );
}

const pageShell = {
  minHeight: "calc(100vh - 3.5rem)",
  padding: "2rem 1.25rem 3rem",
  boxSizing: "border-box",
  background: "transparent",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  overflowX: "hidden",
};

const card = {
  width: "100%",
  maxWidth: "620px",
  borderRadius: "16px",
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

const fundingEnvBadgeDetail = {
  display: "inline-block",
  padding: "0.22rem 0.55rem",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #e2e8f0",
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
