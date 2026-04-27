import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import { createWalletFundedNotification } from "../lib/notificationService";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function friendlyFundingError(err) {
  const raw = String(err?.message || err || "").trim();
  if (!raw) return "Could not complete funding. Try again.";
  if (raw.length > 160) return `${raw.slice(0, 157)}…`;
  return raw;
}

const inputBase = {
  padding: "0.72rem 0.8rem",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "1rem",
  fontVariantNumeric: "tabular-nums",
  background: "#f4f6f9",
  color: "#0f172a",
};

const fundFocusCss = `
  .tc-fund-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-fund-in::placeholder { color: #94a3b8; }
`;

const labelBase = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#94a3b8",
  marginBottom: "0.5rem",
};

const simpleLabel = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const cardFieldLabel = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

export default function FundWalletPage() {
  const { user, profile, loading: authLoading } = useUser();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [successBanner, setSuccessBanner] = useState(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[fund-wallet] fetchWalletBalance:", error);
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

  const handleFund = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const amt = parseFloat(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg("Please enter a valid amount.");
      return;
    }

    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 4) {
      setErrorMsg("Enter a card number (demo — any 4+ digits).");
      return;
    }

    const exp = expiry.trim();
    if (!exp || exp.length < 4) {
      setErrorMsg("Enter expiry as MM/YY.");
      return;
    }

    const cv = cvv.replace(/\s/g, "");
    if (!cv || cv.length < 3) {
      setErrorMsg("Enter CVV (demo — 3 or 4 digits).");
      return;
    }

    if (!user?.id) return;

    setLoading(true);

    try {
      const { error } = await supabase.rpc("fund_wallet", {
        p_user_id: user.id,
        p_amount: amt,
      });

      if (error) {
        console.error("[fund-wallet] fund_wallet RPC failed:", error);
        setErrorMsg(friendlyFundingError(error));
        return;
      }

      await fetchWalletBalance();

      try {
        await evaluateAndLogFraud({
          userId: user.id,
          transactionType: "fund",
          amount: amt,
          senderId: user.id,
          recipientId: user.id,
          timestamp: new Date().toISOString(),
        });
      } catch (fraudError) {
        console.error("[fund-wallet] fraud logging failed:", fraudError);
      }

      try {
        await createWalletFundedNotification({
          userId: user.id,
          amountFormatted: formatMoney(amt),
        });
      } catch (notifErr) {
        console.error("[fund-wallet] notification failed:", notifErr);
      }

      setAmount("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
      setSuccessBanner({ amountFormatted: formatMoney(amt) });
    } catch (unexpected) {
      console.error("[fund-wallet] unexpected error:", unexpected);
      setErrorMsg(friendlyFundingError(unexpected));
    } finally {
      setLoading(false);
    }
  };

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const pageStyle = {
    padding: "2rem 1.25rem 3rem",
    maxWidth: "500px",
    margin: "0 auto",
    minHeight: "calc(100vh - 3.5rem)",
    background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
    boxSizing: "border-box",
  };

  const formDisabled = loading || !!successBanner;

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageStyle}>
          <h2
            style={{
              fontSize: "1.55rem",
              fontWeight: 600,
              color: "#f8fafc",
              marginBottom: "1.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fund Wallet
          </h2>
          <p style={{ color: "#64748b" }}>Loading...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageStyle}>
          <h2
            style={{
              fontSize: "1.55rem",
              fontWeight: 600,
              color: "#f8fafc",
              marginBottom: "1.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fund Wallet
          </h2>
          <p style={{ color: "#64748b" }}>Sign in to add funds.</p>
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
      <style dangerouslySetInnerHTML={{ __html: fundFocusCss }} />
      <Navbar />
      <div style={pageStyle}>
        <h2
          style={{
            fontSize: "1.55rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: "#f8fafc",
            letterSpacing: "-0.02em",
          }}
        >
          Fund Wallet
        </h2>

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
              Added ${successBanner.amountFormatted} to your wallet
            </span>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#2c7a7b" }}>
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
            ${formatMoney(walletBalance)}
          </p>
        </div>

        <form onSubmit={handleFund}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label htmlFor="fund-amount" style={simpleLabel}>
              Amount
            </label>
            <input
              id="fund-amount"
              className="tc-fund-in"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={formDisabled}
              style={{ ...inputBase, marginTop: "0.3rem" }}
            />
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Minimum $0.01. Card charge is simulated until processing goes live.
            </p>
          </div>

          {amountLooksValid && !successBanner ? (
            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              You are adding ${formatMoney(parsedAmount)} to your wallet
            </p>
          ) : null}

          <div
            style={{
              marginBottom: "1.25rem",
              padding: "1.2rem 1.2rem",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
            }}
          >
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#0f172a",
                margin: "0 0 0.35rem",
              }}
            >
              Card details
            </p>
            <p
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.75rem",
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              UI only — not sent to a processor yet.
            </p>

            <label htmlFor="fund-card" style={{ ...cardFieldLabel, marginTop: "0.5rem" }}>
              Card number
            </label>
            <input
              id="fund-card"
              className="tc-fund-in"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="0000 0000 0000 0000"
              disabled={formDisabled}
              style={{
                ...inputBase,
                marginTop: "0.5rem",
                marginBottom: "0.5rem",
                letterSpacing: "0.04em",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <div style={{ flex: 1 }}>
                <label htmlFor="fund-expiry" style={labelBase}>
                  Expiry
                </label>
                <input
                  id="fund-expiry"
                  className="tc-fund-in"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  maxLength={5}
                  disabled={formDisabled}
                  style={{ ...inputBase, padding: "0.6rem" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="fund-cvv" style={labelBase}>
                  CVV
                </label>
                <input
                  id="fund-cvv"
                  className="tc-fund-in"
                  type="password"
                  autoComplete="off"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="•••"
                  disabled={formDisabled}
                  style={{ ...inputBase, padding: "0.6rem" }}
                />
              </div>
            </div>
          </div>

          {errorMsg ? (
            <p
              style={{
                margin: "0 0 1rem",
                padding: "0.65rem 0.75rem",
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

          <button
            type="submit"
            disabled={formDisabled}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: formDisabled
                ? "#475569"
                : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              border: formDisabled
                ? "1px solid #64748b"
                : "1px solid rgba(59, 130, 246, 0.6)",
              borderRadius: "10px",
              cursor: formDisabled ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "0.95rem",
              opacity: formDisabled ? 0.75 : 1,
              boxShadow: formDisabled ? "none" : "0 4px 14px rgba(37, 99, 235, 0.35)",
            }}
          >
            {loading ? "Processing..." : "Fund with Card"}
          </button>
        </form>

        {profile?.full_name ? (
          <p
            style={{
              marginTop: "2rem",
              fontSize: "0.85rem",
              color: "#64748b",
            }}
          >
            Signed in as {profile.full_name}
          </p>
        ) : null}
      </div>
    </>
  );
}