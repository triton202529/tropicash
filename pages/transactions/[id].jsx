import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import Navbar from "../../components/Navbar";

export default function TransactionDetailPage() {
  const router = useRouter();
  const rawId = router.query?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { user, loading: authLoading } = useUser();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!router.isReady || authLoading) return;

    if (!user?.id) {
      setTransaction(null);
      setLoading(false);
      return;
    }

    if (!id || typeof id !== "string") {
      setTransaction(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchTransaction = async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setTransaction(null);
        setLoading(false);
        return;
      }

      if (data.sender_id !== user.id && data.recipient_id !== user.id) {
        setTransaction(null);
        setLoading(false);
        return;
      }

      setTransaction(data);
      setLoading(false);
    };

    fetchTransaction();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, id, user?.id, authLoading]);

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const handleCopy = () => {
    if (!transaction?.id) return;
    navigator.clipboard.writeText(String(transaction.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel = (transaction?.status || "completed").toString();
  const statusLower = statusLabel.toLowerCase();
  const statusGreen =
    statusLower === "completed" ||
    statusLower === "complete" ||
    statusLower === "success";

  const pageShell = {
    padding: "2rem 1.25rem 3rem",
    maxWidth: "520px",
    margin: "0 auto",
    minHeight: "calc(100vh - 3.5rem)",
    boxSizing: "border-box",
    background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  };

  if (!router.isReady || authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <p style={{ margin: 0, color: "#64748b" }}>Loading receipt...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <p style={{ margin: 0, color: "#64748b" }}>Sign in to view this transaction.</p>
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <p style={{ margin: 0, color: "#64748b" }}>Loading receipt...</p>
        </div>
      </>
    );
  }

  if (!transaction) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <p style={{ margin: 0, color: "#64748b" }}>Transaction not found</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div
        style={{
          ...pageShell,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "1.5rem",
            boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.5rem", color: "#0f172a", fontSize: "1.35rem", fontWeight: 700 }}>Payment Receipt</h2>
            <div
              style={{
                color: statusGreen ? "green" : "#b45309",
                fontWeight: "600",
              }}
            >
              {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1).toLowerCase()}
            </div>
          </div>

          {/* Amount */}
          <div
            style={{
              textAlign: "center",
              fontSize: "2rem",
              fontWeight: "bold",
              marginBottom: "1.5rem",
              color: "#0f172a",
            }}
          >
            ${formatMoney(transaction.amount)}
          </div>

          {/* Details */}
          <div style={{ fontSize: "0.95rem", lineHeight: "1.6" }}>
            <DetailRow label="Date" value={formatDate(transaction.created_at)} />
            <DetailRow label="Sender" value={transaction.sender_id} />
            <DetailRow label="Recipient" value={transaction.recipient_id} />
            <DetailRow label="Transaction ID" value={transaction.id} />
            {transaction.note && (
              <DetailRow label="Note" value={transaction.note} />
            )}
          </div>

          {/* Copy ID */}
          <button
            type="button"
            onClick={handleCopy}
            style={{
              width: "100%",
              marginTop: "1rem",
              padding: "0.6rem",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              background: "#f4f6f9",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy Transaction ID"}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={() => router.push("/transactions")}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.6rem",
              borderRadius: "8px",
              border: "none",
              background: "#0070f3",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <strong style={{ color: "#94a3b8", fontWeight: 600 }}>{label}: </strong>
      <span style={{ color: "#0f172a" }}>{value}</span>
    </div>
  );
}
