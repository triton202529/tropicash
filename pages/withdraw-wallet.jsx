import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { enforceKycForWithdrawal } from "../lib/kycRisk";
import { KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE } from "../lib/serverKycWithdrawalGuard";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import SoftLaunchNotice from "../components/SoftLaunchNotice";
import KycSoftLimitBanner from "../components/KycSoftLimitBanner";
import KycLimitAdvisory from "../components/KycLimitAdvisory";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import { evaluateTrustCheck } from "../lib/trustLayer";
import { fetchDefaultPayoutMethod, formatPayoutDestinationDisplay } from "../lib/payoutMethods";
import { logOperationalError } from "../lib/operationalLogger";
import { notifyAdminNewWithdrawalRequest, fetchUserWithdrawalRequests } from "../lib/withdrawalRequests";
import { buildWithdrawalPhase1Signals, emailDomainOnly } from "../lib/fraudRules";
import { insertPhase1FraudLogs } from "../lib/fraudPhase1Log";
import { assertFinancialActionAllowed, formatFinancialBlockUserMessage } from "../lib/accountSecurityStatus";
import FinancialRestrictionNotice from "../components/FinancialRestrictionNotice";

const MIN_WITHDRAWAL_AMOUNT = 1;
const MAX_WITHDRAWAL_AMOUNT = 250;

function messageForRpcError(err) {
  const msg = String(err?.message || "");
  if (msg.includes("insufficient_funds") || msg.includes("Insufficient funds")) return "Insufficient funds.";
  if (msg.includes("Wallet not found")) return "Wallet not found.";
  if (msg.includes("payout_email_required")) return "Add a payout email before requesting a withdrawal.";
  if (msg.includes("not_authorized")) return "You are not allowed to perform this withdrawal.";
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
  if (v === "pending") return "Pending payout";
  if (v === "processing") return "Processing";
  if (v === "paid") return "Paid";
  if (v === "rejected") return "Rejected";
  if (v === "failed") return "Failed";
  return v ? String(status) : "—";
}

function isValidPayoutEmail(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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
    void logOperationalError({
      category: "notification.create",
      message: error?.message || "create_notification withdraw_wallet failed",
      userId,
      route: "/withdraw-wallet",
      metadata: { code: error?.code },
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
  background: "transparent",
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [defaultPayoutRow, setDefaultPayoutRow] = useState(null);
  const [payoutCheckLoading, setPayoutCheckLoading] = useState(true);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [recentWithdrawalsLoading, setRecentWithdrawalsLoading] = useState(false);
  const [walletFetchError, setWalletFetchError] = useState(null);
  const [payoutFetchError, setPayoutFetchError] = useState(null);
  const [financialBlock, setFinancialBlock] = useState(null);
  const [kycWarningMsg, setKycWarningMsg] = useState(null);
  const [kycBlock, setKycBlock] = useState(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[withdraw-wallet] fetchWalletBalance:", error);
      void logOperationalError({
        category: "wallet.load_balance",
        message: error.message || "wallets select failed",
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { code: error.code },
      });
      setWalletFetchError("We couldn't load your wallet balance. Refresh the page or try again shortly.");
      setWalletBalance(0);
      return;
    }

    setWalletFetchError(null);
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
    const { row, error } = await fetchDefaultPayoutMethod(user.id);
    if (error) {
      void logOperationalError({
        category: "withdraw.payout_default",
        message: error.message || "fetchDefaultPayoutMethod failed",
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { code: error.code },
      });
      setPayoutFetchError("We couldn't verify your saved payout method. Check your connection and refresh.");
      setDefaultPayoutRow(null);
    } else {
      setPayoutFetchError(null);
      setDefaultPayoutRow(row);
    }
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
    setKycBlock(null);

    if (loading) {
      setLoadingAction(false);
      return;
    }

    if (!user || !user.id) {
      setErrorMsg("Sign in to withdraw.");
      setLoadingAction(false);
      return;
    }

    const finGate = await assertFinancialActionAllowed({ userId: user.id, action: "withdraw_wallet" });
    if (!finGate.allowed) {
      setFinancialBlock(finGate);
      setErrorMsg(formatFinancialBlockUserMessage(finGate));
      setLoadingAction(false);
      return;
    }
    setFinancialBlock(null);

    if (!defaultPayoutRow) {
      setErrorMsg("Add a payout method before withdrawing.");
      setLoadingAction(false);
      return;
    }

    const payoutEmail = String(profile?.payout_email || "").trim();
    if (!isValidPayoutEmail(payoutEmail)) {
      setErrorMsg("Add a payout email before requesting a withdrawal.");
      setLoadingAction(false);
      return;
    }

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg("Please enter a valid amount.");
      setLoadingAction(false);
      return;
    }

    if (amt < MIN_WITHDRAWAL_AMOUNT || amt > MAX_WITHDRAWAL_AMOUNT) {
      setErrorMsg(`Withdrawals must be between $${formatMoney(MIN_WITHDRAWAL_AMOUNT)} and $${formatMoney(MAX_WITHDRAWAL_AMOUNT)}.`);
      setLoadingAction(false);
      return;
    }

    if (amt > walletBalance) {
      setErrorMsg("Insufficient funds.");
      setLoadingAction(false);
      return;
    }

    const kycEnforcement = await enforceKycForWithdrawal({ userId: user.id, amount: amt });
    if (!kycEnforcement.allowed) {
      setKycBlock({
        message:
          kycEnforcement.userMessage ||
          "This withdrawal cannot be submitted due to your identity verification limits.",
        showKycLink: String(kycEnforcement.kycStatus || "").toLowerCase() !== "approved",
      });
      setKycWarningMsg(null);
      setErrorMsg("");
      setLoadingAction(false);
      return;
    }
    setKycBlock(null);
    if (kycEnforcement.exceedsLimit && kycEnforcement.mode === "advisory" && kycEnforcement.userMessage) {
      setKycWarningMsg(kycEnforcement.userMessage);
    } else {
      setKycWarningMsg(null);
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

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        const limitRes = await fetch("/api/withdrawals/check-limit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ amount: amt }),
        });
        if (limitRes.status === 403) {
          const payload = await limitRes.json().catch(() => ({}));
          if (payload?.error === "kyc_withdrawal_blocked") {
            const msg =
              typeof payload?.message === "string" && payload.message.trim()
                ? payload.message.trim()
                : KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE;
            setKycBlock({
              message: msg,
              showKycLink: true,
            });
            setKycWarningMsg(null);
            setErrorMsg("");
            setLoadingAction(false);
            return;
          }
          if (payload?.error === "account_restricted") {
            const msg =
              typeof payload?.message === "string" && payload.message.trim()
                ? payload.message.trim()
                : formatFinancialBlockUserMessage({ allowed: false });
            setFinancialBlock({ allowed: false, message: msg, reason: null, status: "restricted" });
            setErrorMsg(msg);
            setLoadingAction(false);
            return;
          }
        }
        if (limitRes.status === 429) {
          const payload = await limitRes.json().catch(() => ({}));
          setErrorMsg(
            typeof payload?.error === "string" && payload.error
              ? payload.error
              : "You've submitted several withdrawal requests recently. Please wait a bit and try again.",
          );
          setLoadingAction(false);
          return;
        }
      }
    } catch (limitErr) {
      void logOperationalError({
        category: "abuse.limiter_error",
        message: limitErr?.message || "withdrawals/check-limit fetch failed",
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { phase: "withdraw_check_limit" },
      });
    }

    // Withdrawal RPC is gated server-side via POST /api/withdrawals/check-limit (KYC, account security, rate limit).
    const { error } = await supabase.rpc("create_withdrawal_request", {
      p_user_id: user.id,
      p_amount: amt,
      p_payout_email: payoutEmail,
    });

    if (error) {
      void logOperationalError({
        category: "withdrawal.create_request",
        message: error.message || "create_withdrawal_request RPC failed",
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { code: error.code },
      });
      setErrorMsg(messageForRpcError(error));
      setLoadingAction(false);
      return;
    }

    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyMinIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [{ count: withdrawalCount24h }, { data: recentFundTxns }] = await Promise.all([
      supabase
        .from("withdrawal_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", dayAgoIso),
      supabase
        .from("transactions")
        .select("id, created_at, amount")
        .in("type", ["fund", "fund_wallet"])
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .gte("created_at", thirtyMinIso)
        .limit(10),
    ]);

    try {
      const phase1Signals = buildWithdrawalPhase1Signals({
        amount: amt,
        withdrawalCount24h: withdrawalCount24h ?? 0,
        accountCreatedAt: user.created_at ?? null,
        profileUpdatedAt: profile?.updated_at ?? null,
        recentFundTxns: recentFundTxns || [],
        payoutEmailDomain: emailDomainOnly(payoutEmail),
      });
      await insertPhase1FraudLogs(
        supabase,
        phase1Signals.map((s) => ({
          userId: user.id,
          transactionType: "withdraw",
          eventType: s.eventType,
          severity: s.severity,
          description: s.description,
          amount: s.amount,
          metadata: s.metadata,
        })),
      );
    } catch (phase1Err) {
      console.error("[withdraw-wallet] phase1 fraud logs failed:", phase1Err);
      void logOperationalError({
        category: "fraud.phase1_client",
        message: phase1Err?.message || String(phase1Err),
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { phase: "withdraw_phase1_signals" },
      });
    }

    await fetchWalletBalance();

    try {
      await notifyAdminNewWithdrawalRequest(amt, { requesterUserId: user.id });
    } catch (adminNotifErr) {
      console.error("[withdraw-wallet] admin withdrawal notification failed:", adminNotifErr);
      void logOperationalError({
        category: "notification.admin_withdrawal_alert",
        message: adminNotifErr?.message || String(adminNotifErr),
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { phase: "notify_admin_throw" },
      });
    }
    await loadRecentWithdrawals();

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
      void logOperationalError({
        category: "fraud.evaluate_client",
        message: fraudErr?.message || String(fraudErr),
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { phase: "evaluateAndLogFraud" },
      });
    }

    let withdrawNotifOk = true;
    try {
      withdrawNotifOk = await insertWithdrawNotification(user.id, amt);
    } catch (notificationErr) {
      console.error("[withdraw-wallet] notification failed:", notificationErr);
      withdrawNotifOk = false;
      void logOperationalError({
        category: "notification.create",
        message: notificationErr?.message || String(notificationErr),
        userId: user.id,
        route: "/withdraw-wallet",
        metadata: { phase: "withdraw_notification_throw" },
      });
    }

    setAmount("");
    setPayoutNote("");
    setSuccessBanner({
      amountFormatted: formatMoney(amt),
      payoutNote: payoutNote.trim(),
      loggingFailed: !withdrawNotifOk,
    });
    setLoadingAction(false);
  };

  const parsedAmount = Number(amount);
  const amountLooksValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_WITHDRAWAL_AMOUNT &&
    parsedAmount <= MAX_WITHDRAWAL_AMOUNT;
  const formDisabled = loadingAction || !!successBanner;
  const hasDefaultPayout = !!defaultPayoutRow;
  const normalizedPayoutEmail = String(profile?.payout_email || "").trim();
  const payoutEmailOk =
    normalizedPayoutEmail.length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPayoutEmail);
  const withdrawButtonDisabled =
    formDisabled ||
    payoutCheckLoading ||
    !hasDefaultPayout ||
    !payoutEmailOk ||
    !amountLooksValid;

  const handleSubmitWithConfirm = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (withdrawButtonDisabled) return;
    setConfirmOpen(true);
  };

  const confirmCopy = amountLooksValid
    ? `You are about to send $${formatMoney(parsedAmount)} to your PayPal account (${normalizedPayoutEmail}). This action cannot be undone.`
    : `Withdrawals must be between $${formatMoney(MIN_WITHDRAWAL_AMOUNT)} and $${formatMoney(MAX_WITHDRAWAL_AMOUNT)}.`;

  const runConfirmedWithdrawal = () => {
    setConfirmOpen(false);
    handleWithdraw({ preventDefault() {} });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>Withdraw Wallet</h1>
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
        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1rem", letterSpacing: "-0.02em" }}>
          Withdraw Wallet
        </h1>

        <FinancialRestrictionNotice gate={financialBlock} />

        <div className="mb-4" style={{ maxWidth: "100%" }}>
          <SoftLaunchNotice />
        </div>

        {(walletFetchError || payoutFetchError) && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: "12px",
              border: "1px solid #fcd34d",
              background: "#fffbeb",
              color: "#92400e",
              fontSize: "0.86rem",
              lineHeight: 1.55,
              maxWidth: "100%",
            }}
          >
            {walletFetchError ? <p style={{ margin: "0 0 0.5rem" }}>{walletFetchError}</p> : null}
            {payoutFetchError ? <p style={{ margin: 0 }}>{payoutFetchError}</p> : null}
          </div>
        )}

        <div
          style={{
            marginBottom: "1.25rem",
            padding: "1rem 1.1rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            background: "rgba(255,255,255,0.9)",
          }}
        >
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>
            How withdrawals work
          </p>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.86rem", color: "#475569", lineHeight: 1.55 }}>
            When you submit a request, your <strong style={{ fontWeight: 700 }}>Tropicash wallet balance is updated
            immediately</strong> for that amount. Funds are <strong style={{ fontWeight: 700 }}>not</strong> sent to
            your bank or card automatically—Tropicash <strong style={{ fontWeight: 700 }}>reviews</strong> each
            payout. After payment is completed <strong style={{ fontWeight: 700 }}>outside the app</strong>, an admin
            marks the request <strong style={{ fontWeight: 700 }}>paid</strong> and you are notified.
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.15rem",
              fontSize: "0.84rem",
              color: "#475569",
              lineHeight: 1.55,
            }}
          >
            <li style={{ marginBottom: "0.35rem" }}>Wallet debited when you submit the request.</li>
            <li style={{ marginBottom: "0.35rem" }}>Team reviews your payout details.</li>
            <li>Admin marks paid only after the external transfer is done.</li>
          </ul>
        </div>

        <SoftEnforcementNotice profile={profile} />

        <KycSoftLimitBanner userId={user?.id} />

        {Array.isArray(recentWithdrawals) &&
        recentWithdrawals.some((rw) => ["pending", "processing"].includes(String(rw?.status || "").toLowerCase())) ? (
          <div
            role="status"
            style={{
              margin: "0.9rem 0 1.1rem",
              padding: "0.85rem 1.05rem",
              borderRadius: "12px",
              border: "1px solid rgba(251, 191, 36, 0.5)",
              background: "#fffbeb",
              color: "#92400e",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, lineHeight: 1.45 }}>
              You already have a withdrawal in progress. Please wait before submitting another.
            </p>
          </div>
        ) : null}

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

        {!payoutCheckLoading && hasDefaultPayout && payoutEmailOk ? (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "1rem 1.1rem",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "rgba(255,255,255,0.9)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
              PayPal payout email
            </p>
            <p style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>
              {normalizedPayoutEmail}
            </p>
            <Link
              href="/profile"
              style={{
                display: "inline-block",
                fontWeight: 700,
                color: "#0ea5e9",
              }}
            >
              Change
            </Link>
          </div>
        ) : null}

        {!payoutCheckLoading && hasDefaultPayout && !payoutEmailOk ? (
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
              Add a payout email before requesting a withdrawal.
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.45 }}>
              Add the email or instructions where you want to receive funds after manual review.
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
              Add PayPal payout email
            </Link>
          </div>
        ) : null}

        {!payoutCheckLoading && hasDefaultPayout ? (
          <p
            style={{
              marginBottom: "1.25rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#334155",
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
                <strong style={{ color: "#234e52" }}>Withdrawal request submitted</strong>{" "}
                <span style={{ color: "#234e52" }}>
                  Your request is being processed. You will be notified once your payout is completed.
                </span>
                <p style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", color: "#2c7a7b", lineHeight: 1.45 }}>
                  Amount: ${successBanner.amountFormatted}. Status: pending.
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

        <form onSubmit={handleSubmitWithConfirm}>
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
            onChange={(e) => {
              setAmount(e.target.value);
              setKycBlock(null);
              setKycWarningMsg(null);
            }}
            placeholder="0.00"
            min="0"
            step="0.01"
            disabled={formDisabled}
            style={inputField}
          />

          {amountLooksValid && !successBanner ? (
            <KycLimitAdvisory userId={user?.id} actionType="withdrawal" amount={parsedAmount} />
          ) : null}

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
            Note (optional)
          </label>
          <input
            id="withdraw-note"
            className="tc-withdraw-in"
            type="text"
            value={payoutNote}
            onChange={(e) => setPayoutNote(e.target.value)}
            placeholder="Optional note"
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

        {confirmOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm withdrawal"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.25rem",
              zIndex: 50,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "420px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                background: "rgba(255,255,255,0.98)",
                boxShadow: "0 18px 55px rgba(15, 23, 42, 0.35)",
                padding: "1rem 1.05rem",
              }}
            >
              <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>Confirm withdrawal</p>
              <p style={{ margin: "0.6rem 0 0.9rem", fontSize: "0.9rem", color: "#475569", lineHeight: 1.55 }}>
                {confirmCopy}
              </p>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  style={{
                    flex: 1,
                    padding: "0.75rem 0.85rem",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    fontWeight: 700,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!payoutEmailOk || !amountLooksValid || loadingAction}
                  onClick={() => runConfirmedWithdrawal()}
                  style={{
                    flex: 1,
                    padding: "0.75rem 0.85rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(59, 130, 246, 0.55)",
                    background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                    fontWeight: 800,
                    color: "#fff",
                    cursor: "pointer",
                    opacity: !payoutEmailOk || !amountLooksValid || loadingAction ? 0.65 : 1,
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {kycBlock ? (
          <div
            role="alert"
            style={{
              marginTop: "1rem",
              padding: "0.75rem 0.85rem",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "0.875rem",
              lineHeight: 1.5,
            }}
          >
            {kycBlock.message}{" "}
            {kycBlock.showKycLink ? (
              <Link href="/kyc" style={{ fontWeight: 700, color: "#991b1b", textDecoration: "underline" }}>
                Verify identity
              </Link>
            ) : null}
          </div>
        ) : null}

        {kycWarningMsg ? (
          <div
            role="status"
            style={{
              marginTop: "1rem",
              padding: "0.75rem 0.85rem",
              borderRadius: "10px",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#92400e",
              fontSize: "0.875rem",
              lineHeight: 1.5,
            }}
          >
            {kycWarningMsg}
          </div>
        ) : null}

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
              color: "#0f172a",
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
                const st = String(rw?.status || "").toLowerCase();
                const statusHelp =
                  st === "pending"
                    ? "Pending payout — waiting for team review."
                    : st === "processing"
                      ? "Processing — your payout is being prepared or paid outside the app."
                      : st === "paid"
                        ? "Paid — this request was marked complete by Tropicash."
                        : st === "failed"
                          ? "Your payout failed. Please contact support."
                          : st === "rejected"
                            ? "Rejected — see your notifications or contact support."
                            : "";
                return (
                  <li
                    key={rw.id}
                    style={{
                      marginBottom: "0.85rem",
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      border: "1px solid rgba(226, 232, 240, 0.95)",
                      background: "rgba(255, 255, 255, 0.95)",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                      ${formatMoney(rw?.amount)}{" "}
                      <span style={{ fontWeight: 600, color: "#38bdf8" }}>{withdrawalStatusLabel(rw?.status)}</span>
                    </p>
                    {statusHelp ? (
                      <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#475569", lineHeight: 1.45 }}>
                        {statusHelp}
                      </p>
                    ) : null}
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
                    {st === "rejected" && rw?.rejection_reason != null && String(rw.rejection_reason).trim() ? (
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#b91c1c", wordBreak: "break-word" }}>
                        Reason: {String(rw.rejection_reason).trim()}
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
