/**
 * Manual Tropicash <-> Triton transfer request page (phase 1).
 *
 * This page is request-only: submitting just inserts a row in
 * `triton_transfer_requests`. No wallet ledger writes, no broker calls,
 * no fund/withdraw RPC invocations happen here. An admin manually moves the
 * request through the queue from /admin/triton-transfers.
 *
 * Rate limiting: this page does NOT call /api/.../check-limit in phase 1.
 * Admins can manually reject obvious spam. A dedicated check-limit endpoint
 * is intentionally deferred to a later phase that introduces real value
 * movement and therefore needs the protection.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import SoftLaunchNotice from "../components/SoftLaunchNotice";
import { useUser } from "../lib/userContext";
import {
  MIN_TRITON_TRANSFER_AMOUNT,
  MAX_TRITON_TRANSFER_AMOUNT,
  createTritonTransferRequest,
  fetchUserTritonTransferRequests,
  tritonTransferStatusBadgeStyle,
} from "../lib/tritonTransfers";
import { assertFinancialActionAllowed, formatFinancialBlockUserMessage } from "../lib/accountSecurityStatus";
import FinancialRestrictionNotice from "../components/FinancialRestrictionNotice";

const pageShell = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "720px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
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

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

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
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatWhen(iso);
}

function directionLabel(direction) {
  if (direction === "to_triton") return "Wallet → Triton";
  if (direction === "from_triton") return "Triton → Wallet";
  return direction || "—";
}

function directionIcon(direction) {
  if (direction === "to_triton") return "↗";
  if (direction === "from_triton") return "↙";
  return "•";
}

function TransferCard({
  direction,
  title,
  description,
  amount,
  setAmount,
  busy,
  successMessage,
  errorMessage,
  onSubmit,
  disabled,
}) {
  const parsed = Number(amount);
  const amountLooksValid =
    Number.isFinite(parsed) &&
    parsed >= MIN_TRITON_TRANSFER_AMOUNT &&
    parsed <= MAX_TRITON_TRANSFER_AMOUNT;
  const submitDisabled = disabled || busy || !amountLooksValid;
  return (
    <form
      onSubmit={onSubmit}
      style={{
        ...cardBase,
        padding: "1.1rem 1.15rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>{description}</p>
      <label htmlFor={`tc-tt-amt-${direction}`} style={labelStyle}>
        Amount (USD)
      </label>
      <input
        id={`tc-tt-amt-${direction}`}
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        disabled={busy || disabled}
        style={inputField}
      />
      <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8" }}>
        Between ${formatMoney(MIN_TRITON_TRANSFER_AMOUNT)} and ${formatMoney(MAX_TRITON_TRANSFER_AMOUNT)}.
      </p>
      <button
        type="submit"
        disabled={submitDisabled}
        style={{
          marginTop: "0.4rem",
          width: "100%",
          padding: "0.75rem",
          borderRadius: "10px",
          border: submitDisabled ? "1px solid #cbd5e1" : "1px solid rgba(59, 130, 246, 0.55)",
          background: submitDisabled
            ? "#e2e8f0"
            : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
          color: submitDisabled ? "#64748b" : "#ffffff",
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: submitDisabled ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Submitting…" : "Request transfer"}
      </button>
      {successMessage ? (
        <p
          role="status"
          style={{
            margin: "0.25rem 0 0",
            padding: "0.65rem 0.75rem",
            borderRadius: "10px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "0.82rem",
            lineHeight: 1.45,
          }}
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          style={{
            margin: "0.25rem 0 0",
            padding: "0.65rem 0.75rem",
            borderRadius: "10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "0.82rem",
            lineHeight: 1.45,
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

export default function TritonTransferPage() {
  const { user, loading } = useUser();

  const [toAmount, setToAmount] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toBusy, setToBusy] = useState(false);
  const [fromBusy, setFromBusy] = useState(false);
  const [toSuccess, setToSuccess] = useState("");
  const [fromSuccess, setFromSuccess] = useState("");
  const [toError, setToError] = useState("");
  const [fromError, setFromError] = useState("");

  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const [financialBlock, setFinancialBlock] = useState(null);

  const loadRecent = useCallback(async () => {
    if (!user?.id) {
      setRecent([]);
      return;
    }
    setRecentLoading(true);
    setRecentError("");
    const { rows, error } = await fetchUserTritonTransferRequests(user.id, 20);
    if (error) {
      setRecent([]);
      setRecentError(error.message || "Could not load your transfer history.");
    } else {
      setRecent(rows);
    }
    setRecentLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      setRecent([]);
      return;
    }
    void loadRecent();
  }, [loading, user?.id, loadRecent]);

  // Server-side Triton transfer enforcement should be added when createTritonTransferRequest is wrapped by an API route.
  const submitTransfer = useCallback(
    async (direction) => {
      const isTo = direction === "to_triton";
      const amount = isTo ? toAmount : fromAmount;
      const setBusy = isTo ? setToBusy : setFromBusy;
      const setError = isTo ? setToError : setFromError;
      const setSuccess = isTo ? setToSuccess : setFromSuccess;
      const setAmount = isTo ? setToAmount : setFromAmount;

      setError("");
      setSuccess("");

      if (!user?.id) {
        setError("Sign in to request a transfer.");
        return;
      }

      const finGate = await assertFinancialActionAllowed({ userId: user.id, action: "triton_transfer" });
      if (!finGate.allowed) {
        setFinancialBlock(finGate);
        setError(formatFinancialBlockUserMessage(finGate));
        return;
      }
      setFinancialBlock(null);

      setBusy(true);
      const { error } = await createTritonTransferRequest({
        userId: user.id,
        direction,
        amount,
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      setAmount("");
      setSuccess("Request submitted. An admin will review it shortly.");
      await loadRecent();
      setBusy(false);
    },
    [user?.id, toAmount, fromAmount, loadRecent],
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>
            Triton transfers
          </h1>
          <p style={{ color: "#64748b" }}>Sign in to request a transfer.</p>
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

  return (
    <>
      <Navbar />
      <div style={pageShell}>
        <div style={{ marginBottom: "1rem" }}>
          <Link href="/wallet" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Back to wallet
          </Link>
        </div>
        <h1
          style={{
            fontSize: "clamp(1.35rem, 4vw, 1.6rem)",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          Triton transfers
        </h1>

        <FinancialRestrictionNotice gate={financialBlock} />

        <div className="mb-4" style={{ marginBottom: "1rem" }}>
          <SoftLaunchNotice />
        </div>

        <div
          role="note"
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem 1rem",
            borderRadius: "12px",
            border: "1px solid #a7f3d0",
            background: "linear-gradient(145deg, #ecfdf5 0%, #ffffff 75%)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857" }}>
            Manually reviewed
          </p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#065f46", lineHeight: 1.5 }}>
            Triton transfers are currently manually reviewed during beta. Requests are queued for an admin
            to process — your wallet balance does <strong>not</strong> change when you submit.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          <TransferCard
            direction="to_triton"
            title="Transfer to Triton"
            description="Move funds from your Tropicash wallet into your Triton account for trading."
            amount={toAmount}
            setAmount={setToAmount}
            busy={toBusy}
            successMessage={toSuccess}
            errorMessage={toError}
            onSubmit={(e) => {
              e.preventDefault();
              void submitTransfer("to_triton");
            }}
            disabled={fromBusy}
          />
          <TransferCard
            direction="from_triton"
            title="Withdraw from Triton"
            description="Move funds from your Triton account back into your Tropicash wallet."
            amount={fromAmount}
            setAmount={setFromAmount}
            busy={fromBusy}
            successMessage={fromSuccess}
            errorMessage={fromError}
            onSubmit={(e) => {
              e.preventDefault();
              void submitTransfer("from_triton");
            }}
            disabled={toBusy}
          />
        </div>

        <section aria-labelledby="recent-triton-heading">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.5rem",
              marginBottom: "0.6rem",
            }}
          >
            <h2
              id="recent-triton-heading"
              style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}
            >
              Recent requests
            </h2>
            <button
              type="button"
              onClick={() => void loadRecent()}
              disabled={recentLoading}
              style={{
                padding: "0.32rem 0.55rem",
                fontSize: "0.7rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 600,
                cursor: recentLoading ? "not-allowed" : "pointer",
                opacity: recentLoading ? 0.6 : 1,
              }}
            >
              {recentLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {recentError ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{recentError}</p>
          ) : recentLoading && recent.length === 0 ? (
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>Loading requests…</p>
          ) : recent.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>No transfer requests yet.</p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
              {recent.map((r) => (
                <li
                  key={String(r.id)}
                  style={{
                    ...cardBase,
                    padding: "0.75rem 0.95rem",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.65rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                      <span aria-hidden="true" style={{ marginRight: "0.3rem" }}>
                        {directionIcon(r.direction)}
                      </span>
                      {directionLabel(r.direction)}
                    </p>
                    <p
                      style={{
                        margin: "0.2rem 0 0",
                        fontSize: "0.78rem",
                        color: "#64748b",
                      }}
                    >
                      Requested {timeAgo(r.created_at)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#0f172a",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ${formatMoney(r.amount)}
                    </span>
                    <span style={tritonTransferStatusBadgeStyle(r.status)}>
                      {String(r.status || "").toLowerCase() || "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
