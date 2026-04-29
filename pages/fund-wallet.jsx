import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
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

function isPayPalFundingCompleted(captureJson) {
  if (!captureJson || typeof captureJson !== "object") return false;
  if (captureJson.status === "COMPLETED") return true;
  const cap = captureJson.purchase_units?.[0]?.payments?.captures?.[0];
  return cap?.status === "COMPLETED";
}

function fundedAmountFromCapture(captureJson) {
  const v = captureJson?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
  if (v == null) return NaN;
  return parseFloat(String(v));
}

async function insertFundNotification(userId, amount) {
  const amountText = formatMoney(amount);
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_type: "fund_wallet",
    p_message: `Wallet funded $${amountText}`,
    p_title: "Wallet funded",
    p_related_transaction_id: null,
  });

  if (error) {
    console.error("[NOTIF_RPC_ERROR][fund_wallet]", {
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

const simpleLabel = {
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
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [successBanner, setSuccessBanner] = useState(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalConfigMissing, setPaypalConfigMissing] = useState(false);
  const [paypalScriptError, setPaypalScriptError] = useState(false);

  const paypalButtonContainerRef = useRef(null);
  const latestAmountRef = useRef("");

  useEffect(() => {
    latestAmountRef.current = amount;
  }, [amount]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setPaypalConfigMissing(true);
      return undefined;
    }

    if (window.paypal) {
      setPaypalReady(true);
      return undefined;
    }

    let cancelled = false;
    const existing = document.querySelector('script[src*="www.paypal.com/sdk/js"]');
    if (existing) {
      const onLoad = () => {
        if (!cancelled && window.paypal) setPaypalReady(true);
      };
      existing.addEventListener("load", onLoad);
      if (window.paypal) setPaypalReady(true);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", onLoad);
      };
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.async = true;
    script.onload = () => {
      if (!cancelled) setPaypalReady(true);
    };
    script.onerror = () => {
      if (!cancelled) setPaypalScriptError(true);
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, []);

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formDisabled = loading || !!successBanner;

  useEffect(() => {
    if (typeof window === "undefined" || !window.paypal) return undefined;
    if (!paypalReady || !user?.id || successBanner) return undefined;

    const container = paypalButtonContainerRef.current;
    if (!container) return undefined;

    if (!amountLooksValid) {
      container.innerHTML = "";
      return undefined;
    }

    let buttonsInstance = null;

    const btns = window.paypal.Buttons({
      style: {
        layout: "vertical",
        shape: "rect",
        label: "paypal",
      },
      createOrder: async () => {
        setErrorMsg("");
        setLoading(true);
        try {
          const amt = parseFloat(latestAmountRef.current);
          if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("Please enter a valid amount.");
          }
          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: amt }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || "Could not start PayPal checkout.");
          }
          if (!data.orderID) {
            throw new Error("PayPal did not return an order ID.");
          }
          return data.orderID;
        } finally {
          setLoading(false);
        }
      },
      onApprove: async (data) => {
        setErrorMsg("");
        setLoading(true);
        try {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          const capture = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(capture.error || "PayPal could not complete the payment.");
          }

          if (!isPayPalFundingCompleted(capture)) {
            setErrorMsg("Payment was not completed. Your wallet was not funded.");
            return;
          }

          const fundedAmount = fundedAmountFromCapture(capture);
          if (!Number.isFinite(fundedAmount) || fundedAmount <= 0) {
            setErrorMsg("Could not verify the paid amount. Please contact support.");
            return;
          }

          const { error } = await supabase.rpc("fund_wallet", {
            p_user_id: user.id,
            p_amount: fundedAmount,
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
              amount: fundedAmount,
              senderId: user.id,
              recipientId: user.id,
              timestamp: new Date().toISOString(),
            });
          } catch (fraudError) {
            console.error("[fund-wallet] fraud logging failed:", fraudError);
          }

          try {
            await insertFundNotification(user.id, fundedAmount);
          } catch (notifErr) {
            console.error("[fund-wallet] notification failed:", notifErr);
          }

          setAmount("");
          setSuccessBanner({ amountFormatted: formatMoney(fundedAmount) });
        } catch (unexpected) {
          console.error("[fund-wallet] onApprove error:", unexpected);
          setErrorMsg(friendlyFundingError(unexpected));
        } finally {
          setLoading(false);
        }
      },
      onError: (err) => {
        console.error("[fund-wallet] PayPal SDK error:", err);
        setErrorMsg(
          friendlyFundingError(err) || "PayPal encountered an error. Try again.",
        );
        setLoading(false);
      },
    });

    if (!btns.isEligible()) {
      setErrorMsg("PayPal checkout is not available in this browser. Try another browser or device.");
      return undefined;
    }

    container.innerHTML = "";
    buttonsInstance = btns;
    btns.render(container);

    return () => {
      try {
        buttonsInstance?.close();
      } catch {
        /* ignore */
      }
      container.innerHTML = "";
    };
  }, [paypalReady, amountLooksValid, successBanner, user?.id, fetchWalletBalance]);

  const pageStyle = {
    padding: "2rem 1.25rem 3rem",
    maxWidth: "500px",
    margin: "0 auto",
    minHeight: "calc(100vh - 3.5rem)",
    background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
    boxSizing: "border-box",
  };

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

        <div style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="fund-amount" style={simpleLabel}>
            Amount (USD)
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
            Sandbox only — use PayPal test accounts. Minimum $0.01.
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
            Pay with PayPal
          </p>
          <p
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.75rem",
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Your wallet is funded only after PayPal confirms payment (capture COMPLETED).
          </p>

          {paypalConfigMissing ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "#b45309",
                lineHeight: 1.5,
              }}
            >
              PayPal is not set up yet. Add{" "}
              <code style={{ fontSize: "0.8em" }}>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> and
              server keys to <code style={{ fontSize: "0.8em" }}>.env.local</code>, then
              restart the dev server.
            </p>
          ) : null}

          {paypalScriptError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>
              Could not load PayPal. Check your network and client ID, then refresh the page.
            </p>
          ) : null}

          {!paypalConfigMissing && !paypalScriptError && !paypalReady ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              Loading PayPal…
            </p>
          ) : null}

          {!paypalConfigMissing && !paypalScriptError && paypalReady && !amountLooksValid ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              Enter a valid amount above to enable the PayPal button.
            </p>
          ) : null}

          <div
            ref={paypalButtonContainerRef}
            style={{ marginTop: amountLooksValid && paypalReady ? "0.5rem" : 0 }}
          />
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

        {loading ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>
            Processing…
          </p>
        ) : null}

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
