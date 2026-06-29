import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";
import KycSoftLimitBanner from "../components/KycSoftLimitBanner";
import KycLimitAdvisory from "../components/KycLimitAdvisory";
import { evaluateAndLogFraud } from "../lib/fraudService";
import { SoftEnforcementNotice } from "../lib/softEnforcement";
import { evaluateTrustCheck } from "../lib/trustLayer";
import { assertFinancialActionAllowed, formatFinancialBlockUserMessage } from "../lib/accountSecurityStatus";
import FinancialRestrictionNotice from "../components/FinancialRestrictionNotice";

function walletAmount(row) {
  const raw = row?.wallet_balance ?? row?.balance ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return Number(0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sanitizeSearchTerm(s) {
  return s
    .trim()
    .replace(/%/g, "")
    .replace(/_/g, "")
    .replace(/[,()]/g, " ")
    .replace(/"/g, "")
    .trim();
}

function messageForRpcError(err) {
  const msg = err?.message || "";
  if (msg.includes("insufficient_funds")) return "Insufficient funds.";
  if (msg.includes("not_authorized")) return "You are not allowed to perform this action.";
  if (msg.includes("invalid_amount")) return "Please enter a valid amount.";
  if (msg.includes("cannot_send_to_self")) return "You cannot send money to yourself.";
  return msg || "Transfer failed. Try again.";
}

function recipientDisplayName(profile) {
  if (!profile) return "";
  return profile.full_name?.trim() || profile.email?.trim() || "Recipient";
}

const sendFocusCss = `
  .tc-send-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-send-in::placeholder { color: #94a3b8; }
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
  marginTop: "0.5rem",
  padding: "0.72rem 0.8rem",
  boxSizing: "border-box",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f4f6f9",
  color: "#0f172a",
  fontSize: "0.95rem",
};

export default function SendMoneyPage() {
  const { user, profile, loading: authLoading } = useUser();

  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);
  const [financialBlock, setFinancialBlock] = useState(null);

  const searchWrapRef = useRef(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[send-money] fetch wallet balance failed:", error);
      setBalance(0);
      return;
    }

    setBalance(walletAmount(data));
  }, [user?.id]);

  const fetchRecentContacts = useCallback(async () => {
    if (!user?.id) return;

    const { data: txns, error } = await supabase
      .from("transactions")
      .select("sender_id, recipient_id, created_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[send-money] fetch recent contacts failed:", error);
      setRecentContacts([]);
      return;
    }

    const seen = new Set();
    const orderedIds = [];

    for (const t of txns || []) {
      const other = t.sender_id === user.id ? t.recipient_id : t.sender_id;
      if (!other || other === user.id || seen.has(other)) continue;

      seen.add(other);
      orderedIds.push(other);

      if (orderedIds.length >= 10) break;
    }

    if (orderedIds.length === 0) {
      setRecentContacts([]);
      return;
    }

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", orderedIds);

    if (pErr) {
      console.error("[send-money] fetch recent contact profiles failed:", pErr);
      setRecentContacts([]);
      return;
    }

    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    setRecentContacts(orderedIds.map((id) => byId[id]).filter(Boolean));
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    fetchWalletBalance();
    fetchRecentContacts();
  }, [user?.id, authLoading, fetchWalletBalance, fetchRecentContacts]);

  useEffect(() => {
    if (!user?.id) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const q = sanitizeSearchTerm(searchQuery);

    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    const t = setTimeout(async () => {
      const pattern = `%${q}%`;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .neq("id", user.id)
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(20);

      setSearchLoading(false);

      if (error) {
        console.error("[send-money] search profiles failed:", error);
        setSearchResults([]);
        return;
      }

      setSearchResults(data || []);
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, user?.id]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const onDocClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);

    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!successBanner) return undefined;

    const t = window.setTimeout(() => setSuccessBanner(null), 4500);

    return () => clearTimeout(t);
  }, [successBanner]);

  const pickRecipient = (recipientProfile) => {
    if (!recipientProfile?.id) return;

    setRecipientId(recipientProfile.id);
    setSelectedRecipient(recipientProfile);
    setSearchQuery("");
    setSearchResults([]);
    setDropdownOpen(false);
  };

  // Server-authoritative transfer via POST /api/transfers/send (TLP-002).
  const handleSend = async () => {
    if (sending) return;

    if (!user?.id) {
      alert("Please sign in again.");
      return;
    }

    const amt = Number(amount);

    if (!recipientId || !Number.isFinite(amt) || amt <= 0) {
      alert("Please enter a valid amount and recipient.");
      return;
    }

    if (recipientId === user.id) {
      alert("You cannot send money to yourself.");
      return;
    }

    if (amt > balance) {
      alert("Insufficient funds.");
      return;
    }

    const finGate = await assertFinancialActionAllowed({ userId: user.id, action: "send_money" });
    if (!finGate.allowed) {
      setFinancialBlock(finGate);
      alert(formatFinancialBlockUserMessage(finGate));
      return;
    }
    setFinancialBlock(null);

    setSending(true);

    try {
      const { data: liveWallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError) {
        console.error("[send-money] sender wallet fetch failed:", walletError);
        alert("Could not load your wallet. Try again.");
        return;
      }

      const liveBalance = walletAmount(liveWallet);

      if (amt > liveBalance) {
        setBalance(liveBalance);
        alert("Insufficient funds.");
        return;
      }

      const trust = await evaluateTrustCheck({
        userId: user.id,
        transactionType: "send",
        amount: amt,
        profile,
      });
      if (!trust.allowed) {
        alert(trust.message);
        return;
      }
      if (trust.severity === "warning") {
        const ok = window.confirm(`${trust.message}\n\nContinue with this transfer?`);
        if (!ok) return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        alert("Please sign in again.");
        return;
      }

      const transferRes = await fetch("/api/transfers/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          amount: amt,
        }),
      });

      const transferPayload = await transferRes.json().catch(() => ({}));

      if (!transferRes.ok) {
        const msg =
          typeof transferPayload?.message === "string" && transferPayload.message.trim()
            ? transferPayload.message.trim()
            : typeof transferPayload?.error === "string"
              ? messageForRpcError({ message: transferPayload.error })
              : "Transfer failed. Try again.";
        alert(msg);
        fetchWalletBalance();
        return;
      }

      const lastTxn = transferPayload?.transaction_id
        ? { id: transferPayload.transaction_id }
        : null;

      await fetchWalletBalance();
      await fetchRecentContacts();

      const sentName = recipientDisplayName(selectedRecipient);

      if (lastTxn?.id) {
        try {
          await evaluateAndLogFraud({
            userId: user.id,
            transactionType: "send_money",
            amount: amt,
            senderId: user.id,
            recipientId,
            timestamp: new Date().toISOString(),
            relatedTransactionId: lastTxn.id,
          });
        } catch (fraudErr) {
          console.error("[send-money] fraud logging failed:", fraudErr);
        }
      }

      try {
        const amountText = formatMoney(amt);
        const senderNotif = await supabase.rpc("create_notification", {
          p_user_id: user.id,
          p_type: "send_money",
          p_message: `You sent $${amountText}`,
          p_title: "Money sent",
          p_related_transaction_id: lastTxn?.id || null,
        });
        if (senderNotif.error) {
          console.error("[NOTIF_RPC_ERROR][send_money][sender]", {
            message: senderNotif.error?.message,
            details: senderNotif.error?.details,
            hint: senderNotif.error?.hint,
            code: senderNotif.error?.code,
            raw: senderNotif.error,
          });
        }

        const recipientNotif = await supabase.rpc("create_notification", {
          p_user_id: recipientId,
          p_type: "receive_money",
          p_message: `You received $${amountText}`,
          p_title: "Money received",
          p_related_transaction_id: lastTxn?.id || null,
        });
        if (recipientNotif.error) {
          console.error("[NOTIF_RPC_ERROR][send_money][recipient]", {
            message: recipientNotif.error?.message,
            details: recipientNotif.error?.details,
            hint: recipientNotif.error?.hint,
            code: recipientNotif.error?.code,
            raw: recipientNotif.error,
          });
        }
      } catch (notificationErr) {
        console.error("[send-money] notification failed:", notificationErr);
      }

      setSuccessBanner({
        recipientName: sentName,
        amountFormatted: formatMoney(amt),
        receiptId: lastTxn?.id != null && lastTxn.id !== "" ? String(lastTxn.id) : null,
      });

      setAmount("");
      setRecipientId("");
      setSelectedRecipient(null);
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageShell}>
          <h2 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>
            Send Money
          </h2>
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
          <h2 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>
            Send Money
          </h2>
          <p style={{ color: "#64748b" }}>Sign in to send money.</p>
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

  const showSearchDropdown = dropdownOpen && (searchLoading || searchResults.length > 0 || searchQuery.trim());

  const parsedAmount = Number(amount);
  const amountLooksValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const confirmName = recipientDisplayName(selectedRecipient);

  return (
    <>
      <Navbar />
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes sendMoneyBannerIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`,
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: sendFocusCss }} />

      <div style={pageShell}>
        <FinancialRestrictionNotice gate={financialBlock} />
        <h2
          style={{
            fontSize: "1.55rem",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.25rem",
            letterSpacing: "-0.02em",
          }}
        >
          Send Money
        </h2>

        <SoftEnforcementNotice profile={profile} />

        <KycSoftLimitBanner userId={user?.id} />

        {successBanner ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: "1rem",
              padding: "1rem 1.1rem",
              borderRadius: "10px",
              border: "1px solid #a7f3d0",
              background: "#ecfdf5",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.12)",
              animation: "sendMoneyBannerIn 0.4s ease-out",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              aria-label="Dismiss"
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "0.45rem",
                border: "none",
                background: "transparent",
                color: "#047857",
                fontSize: "1.25rem",
                lineHeight: 1,
                cursor: "pointer",
                padding: "0.15rem 0.35rem",
              }}
            >
              ×
            </button>

            <p
              style={{
                margin: 0,
                paddingRight: "1.75rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#065f46",
                lineHeight: 1.45,
              }}
            >
              Sent ${successBanner.amountFormatted} to {successBanner.recipientName}
            </p>

            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#047857" }}>
              Your transfer went through.
            </p>

            <div style={{ marginTop: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <Link
                href={
                  successBanner.receiptId
                    ? `/transactions?receipt=${encodeURIComponent(successBanner.receiptId)}`
                    : "/transactions"
                }
                style={{
                  display: "inline-block",
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  background: "#047857",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {successBanner.receiptId ? "View Receipt" : "View activity"}
              </Link>
            </div>
          </div>
        ) : null}

        <p style={{ margin: "0.75rem 0 0", fontSize: "1rem", color: "#64748b" }}>
          <strong style={{ color: "#94a3b8" }}>Balance:</strong>{" "}
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0f172a" }}>
            ${formatMoney(balance)}
          </span>
        </p>

        <div style={{ marginTop: "1.25rem" }}>
          <strong
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Recent contacts
          </strong>

          {recentContacts.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.35rem" }}>
              No recent contacts yet. Send money or search below.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {recentContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickRecipient(c)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "999px",
                    border: "1px solid rgba(148, 163, 184, 0.55)",
                    background: recipientId === c.id ? "rgba(14, 165, 233, 0.2)" : "#f8fafc",
                    color: "#0f172a",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: recipientId === c.id ? 600 : 500,
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  {c.full_name || c.email || c.id}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: "1.35rem" }} ref={searchWrapRef}>
          <strong
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Find someone
          </strong>

          <input
            type="search"
            className="tc-send-in"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search by name or email"
            style={inputField}
          />

          {showSearchDropdown && (
            <div
              style={{
                marginTop: "0.35rem",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                maxHeight: "220px",
                overflowY: "auto",
                background: "#ffffff",
                boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
              }}
            >
              {searchLoading && (
                <div style={{ padding: "0.75rem", color: "#64748b", fontSize: "0.875rem" }}>
                  Searching…
                </div>
              )}

              {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                <div style={{ padding: "0.75rem", color: "#64748b", fontSize: "0.875rem" }}>
                  No matches
                </div>
              )}

              {!searchLoading &&
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickRecipient(r)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "0.65rem 0.75rem",
                      border: "none",
                      borderBottom: "1px solid #e2e8f0",
                      background: recipientId === r.id ? "#e0f2fe" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.full_name || "—"}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{r.email || ""}</div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {selectedRecipient && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1.15rem 1.2rem",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#94a3b8",
                marginBottom: "0.5rem",
              }}
            >
              Sending to
            </div>

            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>
              {selectedRecipient.full_name?.trim() || selectedRecipient.email?.trim() || "Recipient"}
            </div>

            {selectedRecipient.full_name?.trim() && selectedRecipient.email ? (
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.35rem" }}>
                {selectedRecipient.email}
              </div>
            ) : null}

            {selectedRecipient.phone ? (
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.35rem" }}>
                {selectedRecipient.phone}
              </div>
            ) : null}
          </div>
        )}

        <input
          type="number"
          className="tc-send-in"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          style={{ ...inputField, marginTop: "1rem" }}
        />

        {amountLooksValid ? (
          <KycLimitAdvisory userId={user?.id} actionType="send" amount={parsedAmount} />
        ) : null}

        {selectedRecipient && amountLooksValid ? (
          <p
            style={{
              marginTop: "1rem",
              marginBottom: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            You are sending ${formatMoney(parsedAmount)} to {confirmName}
          </p>
        ) : selectedRecipient ? (
          <p
            style={{
              marginTop: "1rem",
              marginBottom: 0,
              fontSize: "0.875rem",
              color: "#64748b",
            }}
          >
            Enter a valid amount to confirm your transfer.
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          style={{
            marginTop: "1.15rem",
            padding: "0.75rem 1.25rem",
            borderRadius: "10px",
            border: sending ? "1px solid #64748b" : "1px solid rgba(59, 130, 246, 0.55)",
            background: sending ? "#475569" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: sending ? "not-allowed" : "pointer",
            opacity: sending ? 0.75 : 1,
            boxShadow: sending ? "none" : "0 4px 14px rgba(37, 99, 235, 0.35)",
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </>
  );
}