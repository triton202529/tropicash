import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import { evaluateTrustCheck } from "../lib/trustLayer";
import { fetchDefaultPayoutMethod, formatPayoutDestinationDisplay } from "../lib/payoutMethods";
import {
  insertWithdrawalRequestAfterWalletDebit,
  notifyAdminNewWithdrawalRequest,
  fetchUserWithdrawalRequests,
} from "../lib/withdrawalRequests";

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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function withdrawalStatusLabel(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "processing") return "Processing";
  if (v === "paid") return "Paid";
  if (v === "rejected") return "Rejected";
  return v ? String(status) : "—";
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
  const { user, profile, loading } = useUser();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successBanner, setSuccessBanner] = useState(null);
  const [defaultPayoutRow, setDefaultPayoutRow] = useState(null);
  const [payoutCheckLoading, setPayoutCheckLoading] = useState(true);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [recentWithdrawalsLoading, setRecentWithdrawalsLoading] = useState(false);

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

  const loadDefaultPayout = useCallback(async () => {
    if (!user?.id) {
      setDefaultPayoutRow(null);
      setPayoutCheckLoading(false);
      return;
    }
    setPayoutCheckLoading(true);
    const { row } = await fetchDefaultPayoutMethod(user.id);
    setDefaultPayoutRow(row);
    setPayoutCheckLoading(false);
  }, [user?.id]);

  const loadRecentWithdrawals = useCallback(async () => {
    if (!user?.id) {
      setRecentWithdrawals([]);
      return;
    }
    setRecentWithdrawalsLoading(true);
    const { rows, error } = await fetchUserWithdrawalRequests(user.id, 20);
    if (error) {
      setRecentWithdrawals([]);
    } else {
      setRecentWithdrawals(rows);
    }
    setRecentWithdrawalsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;
    fetchWalletBalance();
  }, [loading, user?.id, fetchWalletBalance]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      setDefaultPayoutRow(null);
      setPayoutCheckLoading(false);
      return;
    }
    loadDefaultPayout();
  }, [loading, user?.id, loadDefaultPayout]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      setRecentWithdrawals([]);
      return;
    }
    void loadRecentWithdrawals();
  }, [loading, user?.id, loadRecentWithdrawals]);

  useEffect(() => {
    if (!successBanner) return undefined;
    const ms = successBanner.loggingFailed ? 9000 : 4500;
    const t = window.setTimeout(() => {
      setSuccessBanner(null);
      router.push("/wallet");
    }, ms);
    return () => clearTimeout(t);
  }, [successBanner, router]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    setErrorMsg("");

    if (loading) {
      setLoadingAction(false);
      return;
    }

    if (!user || !user.id) {
      setErrorMsg("Sign in to withdraw.");
      setLoadingAction(false);
      return;
    }

    if (!defaultPayoutRow) {
      setErrorMsg("Add a payout method before withdrawing.");
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

    const trust = await evaluateTrustCheck({
      userId: user.id,
      transactionType: "withdraw",
      amount: amt,
      profile,
    });
    if (!trust.allowed) {
      setErrorMsg(trust.message);
      setLoadingAction(false);
      return;
    }
    if (trust.severity === "warning") {
      const ok = window.confirm(`${trust.message}\n\nContinue with this withdrawal?`);
      if (!ok) {
        setLoadingAction(false);
        return;
      }
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

    const { error: requestLogError } = await insertWithdrawalRequestAfterWalletDebit({
      userId: user.id,
      amount: amt,
      payoutMethodId: defaultPayoutRow.id,
      payoutLabel: formatPayoutDestinationDisplay(defaultPayoutRow),
    });

    if (requestLogError) {
      console.error("[withdraw-wallet] withdrawal_requests insert failed:", requestLogError);
    } else {
      try {
        await notifyAdminNewWithdrawalRequest(amt);
      } catch (adminNotifErr) {
        console.error("[withdraw-wallet] admin withdrawal notification failed:", adminNotifErr);
      }
      await loadRecentWithdrawals();
    }

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
      loggingFailed: !!requestLogError,
    });
    setLoadingAction(false);
  };

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formDisabled = loadingAction || !!successBanner;
  const hasDefaultPayout = !!defaultPayoutRow;
  const withdrawButtonDisabled = formDisabled || payoutCheckLoading || !hasDefaultPayout;

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.5rem" }}>
            Withdraw Wallet
          </h1>
          <p style={{ color: "#64748b" }}>Loading withdraw page...</p>
        </div>
      </>
    );
  }

  if (!loading && !user) {
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

        <div
          style={{
            marginBottom: "1.25rem",
            padding: "1rem 1.1rem",
            borderRadius: "12px",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            background: "rgba(14, 165, 233, 0.1)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#bae6fd", lineHeight: 1.5 }}>
            Beta withdrawals are processed manually. After submitting, Tropicash will send your payout to your saved payout
            method. Processing time may vary during beta.
          </p>
        </div>

        <SoftEnforcementNotice profile={profile} />

        {payoutCheckLoading ? (
          <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#94a3b8" }}>Checking payout method…</p>
        ) : null}

        {!payoutCheckLoading && !hasDefaultPayout ? (
          <div
            role="alert"
            style={{
              marginBottom: "1.25rem",
              padding: "1rem 1.1rem",
              borderRadius: "12px",
              border: "1px solid rgba(251, 191, 36, 0.45)",
              background: "rgba(254, 243, 199, 0.12)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#fcd34d" }}>
              Add a payout method before withdrawing.
            </p>
            <Link
              href="/profile"
              style={{
                display: "inline-block",
                marginTop: "0.85rem",
                fontWeight: 600,
                color: "#38bdf8",
              }}
            >
              Add payout method
            </Link>
          </div>
        ) : null}

        {!payoutCheckLoading && hasDefaultPayout ? (
          <p
            style={{
              marginBottom: "1.25rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#e2e8f0",
              lineHeight: 1.45,
            }}
          >
            Withdraw to {formatPayoutDestinationDisplay(defaultPayoutRow)}
          </p>
        ) : null}

        {successBanner ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              borderRadius: "8px",
              border: successBanner.loggingFailed ? "1px solid #f97316" : "1px solid #38b2ac",
              background: successBanner.loggingFailed ? "#fff7ed" : "#e6fffa",
            }}
          >
            {successBanner.loggingFailed ? (
              <>
                <strong style={{ color: "#9a3412" }}>Important:</strong>{" "}
                <span style={{ color: "#7c2d12" }}>
                  Withdrawal deducted but request logging failed. Contact support immediately.
                </span>
              </>
            ) : (
              <>
                <strong style={{ color: "#234e52" }}>Request submitted:</strong>{" "}
                <span style={{ color: "#234e52" }}>
                  Withdrawal request submitted. Your wallet has been debited and Tropicash will process the payout manually.
                </span>
                <p style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", color: "#2c7a7b", lineHeight: 1.45 }}>
                  Amount: ${successBanner.amountFormatted}. Payout is not completed until our team marks it paid after sending
                  funds outside the app.
                </p>
              </>
            )}
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: successBanner.loggingFailed ? "#9a3412" : "#2c7a7b" }}>
              Redirecting to your wallet…
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
          <label
            htmlFor="withdraw-amt"
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
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

          <label
            htmlFor="withdraw-note"
            style={{
              display: "block",
              marginTop: "1rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
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
            disabled={withdrawButtonDisabled}
            style={{
              marginTop: "1.15rem",
              width: "100%",
              padding: "0.85rem",
              borderRadius: "10px",
              border: withdrawButtonDisabled ? "1px solid #64748b" : "1px solid rgba(59, 130, 246, 0.55)",
              background: withdrawButtonDisabled ? "#475569" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: withdrawButtonDisabled ? "not-allowed" : "pointer",
              opacity: withdrawButtonDisabled ? 0.75 : 1,
              boxShadow: withdrawButtonDisabled ? "none" : "0 4px 14px rgba(37, 99, 235, 0.35)",
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

        <section style={{ marginTop: "2rem" }} aria-labelledby="recent-withdrawals-heading">
          <h2
            id="recent-withdrawals-heading"
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "-0.01em",
            }}
          >
            Recent withdrawal requests
          </h2>
          {recentWithdrawalsLoading ? (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>Loading requests…</p>
          ) : recentWithdrawals.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>No withdrawal requests yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recentWithdrawals.map((rw) => {
                const payout = rw?.payout_label != null ? String(rw.payout_label).trim() : "";
                const paidAt = rw?.paid_at ? formatWhen(rw.paid_at) : null;
                const paidVia = rw?.paid_via != null ? String(rw.paid_via).trim() : "";
                const extRef = rw?.external_reference != null ? String(rw.external_reference).trim() : "";
                return (
                  <li
                    key={rw.id}
                    style={{
                      marginBottom: "0.85rem",
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      background: "rgba(15, 23, 42, 0.65)",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>
                      ${formatMoney(rw?.amount)}{" "}
                      <span style={{ fontWeight: 600, color: "#38bdf8" }}>{withdrawalStatusLabel(rw?.status)}</span>
                    </p>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.45 }}>
                      {payout || "—"}
                    </p>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                      Requested {formatWhen(rw?.created_at)}
                    </p>
                    {paidAt ? (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>Paid {paidAt}</p>
                    ) : null}
                    {paidVia ? (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                        Paid via: {paidVia}
                      </p>
                    ) : null}
                    {extRef ? (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", wordBreak: "break-word" }}>
                        Reference: {extRef}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
