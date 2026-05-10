import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import SoftLaunchNotice from "../components/SoftLaunchNotice";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import { evaluateTrustCheck } from "../lib/trustLayer";
import { buildPayPalFundWalletSdkUrl } from "../lib/paypalSdkUrl";
import {
  fundingMethodFromPayPalApproveData,
  fundingMethodLabel,
  formatPayPalEnvironmentBadge,
  getPayPalAppEnvironment,
  rememberFundingPaymentSource,
} from "../lib/paymentSource";

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

const simpleLabel = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const receiptRowLabel = {
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: "0.2rem",
};

const receiptRowValue = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#0f172a",
  wordBreak: "break-word",
};

const sandboxModeBadge = {
  display: "inline-block",
  padding: "0.2rem 0.55rem",
  borderRadius: "999px",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #e2e8f0",
};

const liveModeBadge = {
  display: "inline-block",
  padding: "0.22rem 0.6rem",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #f87171",
  boxShadow: "0 0 0 1px rgba(185, 28, 28, 0.12)",
};

export default function FundWalletPage() {
  const { user, profile, loading: authLoading } = useUser();

  const [amount, setAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalConfigMissing, setPaypalConfigMissing] = useState(false);
  const [paypalScriptError, setPaypalScriptError] = useState(false);
  const [fundTrust, setFundTrust] = useState({ status: "idle", result: null });

  const paypalButtonContainerRef = useRef(null);
  const latestAmountRef = useRef("");
  const captureInFlightRef = useRef(false);

  const paypalUiMode = useMemo(() => {
    const raw = String(process.env.NEXT_PUBLIC_PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
    if (raw === "live") return "live";
    if (raw === "sandbox") return "sandbox";
    return "sandbox";
  }, []);

  useEffect(() => {
    const raw = String(process.env.NEXT_PUBLIC_PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
    if (
      process.env.NODE_ENV === "development" &&
      raw !== "sandbox" &&
      raw !== "live" &&
      process.env.NEXT_PUBLIC_PAYPAL_MODE
    ) {
      console.warn(
        `[fund-wallet] Invalid NEXT_PUBLIC_PAYPAL_MODE "${process.env.NEXT_PUBLIC_PAYPAL_MODE}", using sandbox.`,
      );
    }
  }, []);

  useEffect(() => {
    latestAmountRef.current = amount;
  }, [amount]);

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

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
    if (!user?.id) {
      setFundTrust({ status: "idle", result: null });
      return undefined;
    }
    if (!amountLooksValid) {
      setFundTrust({ status: "idle", result: null });
      return undefined;
    }

    let cancelled = false;
    setFundTrust({ status: "loading", result: null });

    (async () => {
      const r = await evaluateTrustCheck({
        userId: user.id,
        transactionType: "fund",
        amount: parsedAmount,
        profile,
      });
      if (!cancelled) setFundTrust({ status: "ready", result: r });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile, parsedAmount, amountLooksValid]);

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
    const desiredSdkUrl = buildPayPalFundWalletSdkUrl(clientId);
    const existing =
      document.querySelector(`script[src="${CSS.escape(desiredSdkUrl)}"]`) ||
      document.querySelector('script[src*="www.paypal.com/sdk/js"]');
    if (existing) {
      if (existing.src !== desiredSdkUrl) {
        console.warn(
          "[fund-wallet] PayPal SDK already loaded with different options. Hard-refresh the page for Caribbean locale and billing defaults.",
        );
      }
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
    script.src = desiredSdkUrl;
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
  }, [paypalUiMode]);

  const formDisabled = loading || !!successReceipt;

  useEffect(() => {
    if (typeof window === "undefined" || !window.paypal) return undefined;
    if (!paypalReady || !user?.id || successReceipt) return undefined;

    const container = paypalButtonContainerRef.current;
    if (!container) return undefined;

    if (!amountLooksValid) {
      container.innerHTML = "";
      return undefined;
    }

    if (fundTrust.status === "loading") {
      container.innerHTML = `<p style="margin:0;font-size:0.875rem;color:#64748b;">Checking limits…</p>`;
      return undefined;
    }

    if (fundTrust.status !== "ready" || !fundTrust.result) {
      container.innerHTML = "";
      return undefined;
    }

    if (!fundTrust.result.allowed) {
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
        if (captureInFlightRef.current) return;
        captureInFlightRef.current = true;
        setErrorMsg("");
        setLoading(true);
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const accessToken = session?.access_token;
          if (!accessToken) {
            setErrorMsg("Your session expired. Sign in again and retry.");
            return;
          }

          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            const apiErr = String(payload.error || "").trim();
            setErrorMsg(
              apiErr || "PayPal could not complete the payment.",
            );
            return;
          }

          if (!payload.success || payload.amount == null) {
            setErrorMsg("Payment was not completed. Your wallet was not funded.");
            return;
          }

          const fundedAmount = Number(payload.amount);
          if (!Number.isFinite(fundedAmount) || fundedAmount <= 0) {
            setErrorMsg("Could not verify the paid amount. Please contact support.");
            return;
          }

          const receiptOrderId = payload.orderID || data.orderID || null;
          const paymentMethod = fundingMethodFromPayPalApproveData(data);
          if (receiptOrderId) {
            rememberFundingPaymentSource(receiptOrderId, paymentMethod);
          }

          if (process.env.NODE_ENV !== "production") {
            console.log("[FUNDING_PROCESS]", { orderID: receiptOrderId, duplicate: !!payload.duplicate });
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

          setAmount("");
          setSuccessReceipt({
            amountFormatted: formatMoney(fundedAmount),
            paymentMethod,
            environment: getPayPalAppEnvironment(),
            status: payload.duplicate ? "Completed (already processed)" : "Completed",
            orderId: receiptOrderId,
          });
        } catch (unexpected) {
          console.error("[fund-wallet] onApprove error:", unexpected);
          setErrorMsg(friendlyFundingError(unexpected));
        } finally {
          setLoading(false);
          captureInFlightRef.current = false;
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
  }, [
    paypalReady,
    amountLooksValid,
    successReceipt,
    user?.id,
    fetchWalletBalance,
    fundTrust.status,
    fundTrust.result,
  ]);

  const pageStyle = {
    padding: "2rem 1.25rem 3rem",
    maxWidth: "520px",
    margin: "0 auto",
    minHeight: "calc(100vh - 3.5rem)",
    background: "transparent",
    boxSizing: "border-box",
  };

  const receiptCardStyle = {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "clamp(1.25rem, 4vw, 1.75rem)",
    marginBottom: "1.5rem",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e2e8f0",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const receiptActionsWrap = {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "0.65rem",
    marginTop: "1.35rem",
  };

  const btnPrimary = {
    flex: "1 1 140px",
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.65rem 1rem",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "0.9rem",
    textDecoration: "none",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  const btnSecondary = {
    flex: "1 1 140px",
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.65rem 1rem",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "0.9rem",
    textDecoration: "none",
    background: "transparent",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
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
              color: "#0f172a",
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
              color: "#0f172a",
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
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Fund Wallet
        </h2>

        <SoftEnforcementNotice profile={profile} />

        <div style={{ marginBottom: "1.25rem" }}>
          <SoftLaunchNotice />
        </div>

        <div
          style={{
            marginBottom: "1.25rem",
            padding: "1rem 1.1rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            background: "rgba(255, 255, 255, 0.92)",
          }}
        >
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>How funding appears</p>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.55 }}>
            Successful adds may show in history as <strong style={{ fontWeight: 600 }}>PayPal</strong> or{" "}
            <strong style={{ fontWeight: 600 }}>Card</strong> depending on how you paid. If the app is in test mode, a
            small <strong style={{ fontWeight: 600 }}>Sandbox</strong> or <strong style={{ fontWeight: 600 }}>Live</strong>{" "}
            label may appear next to funding—this only indicates the processing environment, not a separate charge from
            Tropicash.
          </p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.45 }}>
            If something fails, you will see a short user-friendly message here—not technical debug output.
          </p>
        </div>

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

        {successReceipt ? (
          <div
            role="status"
            aria-live="polite"
            style={receiptCardStyle}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.03em",
                  }}
                >
                  Funding Successful
                </h3>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Your wallet has been credited.
                </p>
              </div>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.55rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  background: "#ecfdf5",
                  color: "#047857",
                  border: "1px solid #a7f3d0",
                }}
              >
                {successReceipt.status}
              </span>
            </div>

            <p
              style={{
                margin: "0 0 0.35rem",
                fontSize: "clamp(2rem, 8vw, 2.65rem)",
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
              }}
            >
              ${successReceipt.amountFormatted}
            </p>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.8rem", color: "#64748b" }}>
              Amount funded
            </p>

            <div
              style={{
                display: "grid",
                gap: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div>
                <p style={{ ...receiptRowLabel, margin: 0 }}>Method</p>
                <p style={{ ...receiptRowValue, margin: 0 }}>
                  {fundingMethodLabel(successReceipt.paymentMethod)}
                </p>
              </div>
              <div>
                <p style={{ ...receiptRowLabel, margin: 0 }}>Payment mode</p>
                <p style={{ ...receiptRowValue, margin: 0 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "999px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background:
                        successReceipt.environment === "live" ? "#fef2f2" : "#f1f5f9",
                      color: successReceipt.environment === "live" ? "#991b1b" : "#475569",
                      border:
                        successReceipt.environment === "live"
                          ? "1px solid #f87171"
                          : "1px solid #e2e8f0",
                    }}
                  >
                    {formatPayPalEnvironmentBadge(successReceipt.environment)}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ ...receiptRowLabel, margin: 0 }}>Status</p>
                <p style={{ ...receiptRowValue, margin: 0 }}>{successReceipt.status}</p>
              </div>
              {successReceipt.orderId ? (
                <div>
                  <p style={{ ...receiptRowLabel, margin: 0 }}>Reference (for support)</p>
                  <p
                    style={{
                      ...receiptRowValue,
                      margin: 0,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}
                  >
                    {successReceipt.orderId}
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ ...receiptRowLabel, margin: 0 }}>Reference (for support)</p>
                  <p style={{ ...receiptRowValue, margin: 0, color: "#64748b" }}>—</p>
                </div>
              )}
            </div>

            <div style={receiptActionsWrap}>
              <Link href="/wallet" style={btnPrimary}>
                Back to Wallet
              </Link>
              <Link href="/transactions" style={btnSecondary}>
                View Transactions
              </Link>
            </div>
          </div>
        ) : null}

        {!successReceipt ? (
          <>
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
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45 }}>
                {paypalUiMode === "live"
                  ? "Live payments enabled — real charges may occur."
                  : "Sandbox only — use PayPal test accounts."}{" "}
                Per transaction: minimum $1, maximum $1,000.
              </p>
            </div>

            {amountLooksValid ? (
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
              {fundTrust.status === "ready" &&
              fundTrust.result &&
              !fundTrust.result.allowed &&
              fundTrust.result.message ? (
                <p
                  style={{
                    margin: "0 0 0.75rem",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "10px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: "0.875rem",
                    lineHeight: 1.45,
                  }}
                >
                  {fundTrust.result.message}
                </p>
              ) : null}
              {fundTrust.status === "ready" &&
              fundTrust.result?.allowed &&
              fundTrust.result.severity === "warning" &&
              fundTrust.result.message ? (
                <p
                  style={{
                    margin: "0 0 0.75rem",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "10px",
                    background: "#fffbeb",
                    border: "1px solid #fcd34d",
                    color: "#9a3412",
                    fontSize: "0.875rem",
                    lineHeight: 1.45,
                  }}
                >
                  {fundTrust.result.message}
                </p>
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  Pay with PayPal
                </p>
                <span style={paypalUiMode === "live" ? liveModeBadge : sandboxModeBadge}>
                  {paypalUiMode === "live" ? "Live Mode" : "Sandbox Mode"}
                </span>
              </div>
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
              <p
                style={{
                  margin: "0 0 0.85rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.78rem",
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                For card payments, PayPal may ask for a billing address. Select your correct country
                before entering address details.
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
                  {process.env.NODE_ENV === "development" ? (
                    <>
                      PayPal is not set up yet. Add{" "}
                      <code style={{ fontSize: "0.8em" }}>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> and server keys to{" "}
                      <code style={{ fontSize: "0.8em" }}>.env.local</code>, then restart the dev server.
                    </>
                  ) : (
                    <>Wallet funding is temporarily unavailable. Please try again later or contact support.</>
                  )}
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
          </>
        ) : null}

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
