import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";

function messageForRpcError(err) {
  const msg = String(err?.message || "");
  if (msg.includes("insufficient_funds")) return "Insufficient funds.";
  return "Could not complete withdrawal. Try again.";
}

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function insertWithdrawNotification(userId, amount) {
  const amountText = formatMoney(amount);
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_type: "withdraw_wallet",
    p_message: `Withdrawal $${amountText}`,
    p_title: "Withdrawal",
    p_related_transaction_id: null,
  });
  if (error) {
    console.error("[NOTIF_RPC_ERROR][withdraw_wallet]", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error,
    });
    return false;
  }
  return true;
}

const withdrawFocusCss = `
  .tc-withdraw-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-withdraw-in::placeholder { color: #94a3b8; }
`;

const pageShell = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "500px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  boxSizing: "border-box",
};

const inputField = {
  display: "block",
  width: "100%",
  marginTop: "0.65rem",
  padding: "0.72rem 0.8rem",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f4f6f9",
  color: "#0f172a",
  fontSize: "0.95rem",
};

export default function WithdrawWalletPage() {
  const { user, profile, loading: authLoading } = useUser();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successBanner, setSuccessBanner] = useState(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[withdraw-wallet] fetchWalletBalance:", error);
      setWalletBalance(0);
      return;
    }

    const raw = data?.wallet_balance ?? data?.balance ?? 0;
    setWalletBalance(Number(raw) || 0);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) fetchWalletBalance();
  }, [authLoading, user?.id, fetchWalletBalance]);

  useEffect(() => {
    if (!successBanner) return undefined;
    const t = window.setTimeout(() => {
      setSuccessBanner(null);
      router.push("/wallet");
    }, 2000);
    return () => clearTimeout(t);
  }, [successBanner, router]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    setErrorMsg("");

    if (!user?.id) {
      setErrorMsg("Sign in to withdraw.");
      setLoadingAction(false);
      return;
    }

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg("Please enter a valid amount.");
      setLoadingAction(false);
      return;
    }

    if (amt > walletBalance) {
      setErrorMsg("Insufficient funds.");
      setLoadingAction(false);
      return;
    }

    const { error } = await supabase.rpc("withdraw_wallet", {
      p_user_id: user.id,
      p_amount: amt,
    });

    if (error) {
      setErrorMsg(messageForRpcError(error));
      setLoadingAction(false);
      return;
    }

    await fetchWalletBalance();

    try {
      await evaluateAndLogFraud({
        userId: user.id,
        transactionType: "withdraw",
        amount: amt,
        senderId: user.id,
        recipientId: user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (fraudErr) {
      console.error("[withdraw-wallet] fraud logging failed:", fraudErr);
    }

    try {
      await insertWithdrawNotification(user.id, amt);
    } catch (notificationErr) {
      console.error("[withdraw-wallet] notification failed:", notificationErr);
    }

    setAmount("");
    setPayoutNote("");
    setSuccessBanner({
      amountFormatted: formatMoney(amt),
      payoutNote: payoutNote.trim(),
    });
    setLoadingAction(false);
  };

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formDisabled = loadingAction || !!successBanner;

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.5rem" }}>Withdraw Wallet</h1>
          <p style={{ color: "#64748b" }}>Loading...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.5rem" }}>Withdraw Wallet</h1>
          <p style={{ color: "#64748b" }}>Sign in to withdraw.</p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              fontWeight: 600,
              color: "#0ea5e9",
            }}
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: withdrawFocusCss }} />
      <Navbar />
      <div style={pageShell}>
        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 1rem", letterSpacing: "-0.02em" }}>
          Withdraw Wallet
        </h1>

        <SoftEnforcementNotice profile={profile} />

        {successBanner ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid #38b2ac",
              background: "#e6fffa",
            }}
          >
            <strong style={{ color: "#234e52" }}>Success:</strong>{" "}
            <span style={{ color: "#234e52" }}>
              Withdrawn ${successBanner.amountFormatted} from your wallet
            </span>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#2c7a7b" }}>
              Redirecting to your wallet...
            </p>
          </div>
        ) : null}

        <div
          style={{
            background:
              "linear-gradient(145deg, #1e293b 0%, #2563eb 35%, #1e3a5f 70%, #0f172a 100%)",
            padding: "1.6rem 1.5rem",
            borderRadius: "16px",
            marginBottom: "1.85rem",
            boxShadow: "0 16px 48px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(148, 197, 255, 0.22)",
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
            ${formatMoney(walletBalance)}
          </p>
        </div>

        <form onSubmit={handleWithdraw}>
          <label htmlFor="withdraw-amt" style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
            Amount
          </label>
          <input
            id="withdraw-amt"
            className="tc-withdraw-in"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            disabled={formDisabled}
            style={inputField}
          />

          {amountLooksValid && !successBanner ? (
            <p
              style={{
                margin: "0.75rem 0 0",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              You are withdrawing ${formatMoney(parsedAmount)} from your wallet
            </p>
          ) : null}

          <label htmlFor="withdraw-note" style={{ display: "block", marginTop: "1rem", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
            Bank / payout note
          </label>
          <input
            id="withdraw-note"
            className="tc-withdraw-in"
            type="text"
            value={payoutNote}
            onChange={(e) => setPayoutNote(e.target.value)}
            placeholder="Bank / payout note"
            disabled={formDisabled}
            style={inputField}
          />

          <button
            type="submit"
            disabled={formDisabled}
            style={{
              marginTop: "1.15rem",
              width: "100%",
              padding: "0.85rem",
              borderRadius: "10px",
              border: formDisabled ? "1px solid #64748b" : "1px solid rgba(59, 130, 246, 0.55)",
              background: formDisabled ? "#475569" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: formDisabled ? "not-allowed" : "pointer",
              opacity: formDisabled ? 0.75 : 1,
              boxShadow: formDisabled ? "none" : "0 4px 14px rgba(37, 99, 235, 0.35)",
            }}
          >
            {loadingAction ? "Processing..." : "Withdraw"}
          </button>
        </form>

        {errorMsg ? (
          <p
            style={{
              marginTop: "1rem",
              padding: "0.75rem 0.85rem",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "0.875rem",
            }}
          >
            {errorMsg}
          </p>
        ) : null}
      </div>
    </>
  );
}
