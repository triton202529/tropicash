import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import Navbar from "../components/Navbar";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "received", label: "Received" },
  { id: "funded", label: "Funded" },
  { id: "withdrawn", label: "Withdrawn" },
];

function capitalize(s) {
  if (!s || typeof s !== "string") return "Other";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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

function formatDetailTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatReceiptMoney(value) {
  const n = Math.abs(Number(value));
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

function formatRunningBalance(value) {
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

function partyLabel(userId, partyId, names) {
  if (!partyId) return "—";
  if (partyId === userId) return "You";
  return names[partyId] || partyId;
}

function statusBadgeClasses(statusLabel) {
  const s = (statusLabel || "").toLowerCase();
  if (
    s === "completed" ||
    s === "complete" ||
    s === "success" ||
    s === "succeeded"
  ) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
  }
  if (s === "pending" || s === "processing") {
    return "bg-amber-50 text-amber-900 ring-amber-200/80";
  }
  if (
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "reversed"
  ) {
    return "bg-red-50 text-red-800 ring-red-200/80";
  }
  return "bg-slate-50 text-slate-700 ring-slate-200/80";
}

function directionEmoji(directionLabel) {
  if (directionLabel === "Sent") return "💸";
  if (directionLabel === "Received") return "💰";
  if (directionLabel === "Wallet funded") return "🏦";
  if (directionLabel === "Withdrawal") return "🧾";
  return "";
}

function directionWithIcon(directionLabel) {
  const icon = directionEmoji(directionLabel);
  return icon ? `${icon} ${directionLabel}` : directionLabel;
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function dateGroupKey(iso) {
  if (!iso) return "earlier";
  const txDay = startOfLocalDay(new Date(iso));
  const today = startOfLocalDay(new Date());
  const yesterday = today - 86400000;
  if (txDay === today) return "today";
  if (txDay === yesterday) return "yesterday";
  return "earlier";
}

function enrichTransaction(txn, userId, names) {
  const amt = Number(txn.amount);
  const amountNum = Number.isFinite(amt) ? amt : 0;
  const typeRaw = (txn.type || "").toLowerCase();
  const status = txn.status ? capitalize(String(txn.status)) : null;

  let category = "other";
  let directionLabel = "Activity";
  let counterparty = null;
  let sign = "";
  let outflow = false;

  if (typeRaw === "fund" || typeRaw === "fund_wallet") {
    category = "funded";
    directionLabel = "Wallet funded";
    sign = "+";
    outflow = false;
  } else if (typeRaw === "withdraw") {
    category = "withdrawn";
    directionLabel = "Withdrawal";
    sign = "−";
    outflow = true;
  } else if (typeRaw === "send" || typeRaw === "receive") {
    const selfSend =
      txn.sender_id === userId && txn.recipient_id === userId;
    if (selfSend) {
      category = "funded";
      directionLabel = "Wallet funded";
      sign = "+";
      outflow = false;
    } else if (txn.sender_id === userId) {
      category = "sent";
      directionLabel = "Sent";
      counterparty = names[txn.recipient_id] || null;
      sign = "−";
      outflow = true;
    } else if (txn.recipient_id === userId) {
      category = "received";
      directionLabel = "Received";
      counterparty = names[txn.sender_id] || null;
      sign = "+";
      outflow = false;
    }
  } else {
    directionLabel = capitalize(typeRaw);
    if (txn.sender_id === userId && txn.recipient_id !== userId) {
      sign = "−";
      outflow = true;
      counterparty = names[txn.recipient_id] || null;
    } else if (txn.recipient_id === userId && txn.sender_id !== userId) {
      sign = "+";
      outflow = false;
      counterparty = names[txn.sender_id] || null;
    } else {
      sign = "+";
    }
  }

  const amountStr = `${sign}$${amountNum.toFixed(2)}`;

  return {
    ...txn,
    category,
    directionLabel,
    counterparty,
    amountStr,
    outflow,
    typeLabel: capitalize(typeRaw),
    statusLabel: status,
    whenLabel: formatWhen(txn.created_at),
  };
}

function attachRunningBalances(enriched) {
  const chronological = [...enriched].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  let running = 0;
  const balanceAfterById = new Map();
  for (const t of chronological) {
    const amt = Number(t.amount) || 0;
    running += t.outflow ? -amt : amt;
    balanceAfterById.set(t.id, running);
  }

  return enriched.map((t) => ({
    ...t,
    runningBalance: balanceAfterById.get(t.id) ?? 0,
  }));
}

function ReceiptRow({ label, children, emphasize }) {
  return (
    <div className={emphasize ? "py-3" : "py-2.5"}>
      <p className="text-[0.65rem] font-semibold text-slate-500 uppercase tracking-[0.12em]">
        {label}
      </p>
      <div
        className={`mt-1 text-slate-900 ${
          emphasize ? "text-base font-semibold leading-snug" : "text-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function TransactionDetailModal({ txn, onClose, userId, profileNames }) {
  const [copyDone, setCopyDone] = useState(false);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    setCopyDone(false);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [txn?.id]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!txn) return null;

  const note =
    txn.note != null && String(txn.note).trim() !== ""
      ? String(txn.note)
      : null;

  const senderName = partyLabel(userId, txn.sender_id, profileNames);
  const recipientName = partyLabel(userId, txn.recipient_id, profileNames);
  const idStr = String(txn.id);
  const absAmount = formatReceiptMoney(txn.amount);
  const statusDisplay = txn.statusLabel || "—";

  const copyTransactionId = async () => {
    try {
      await navigator.clipboard.writeText(idStr);
      setCopyDone(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopyDone(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100/90 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white/80 hover:text-slate-800 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <div className="p-5 pt-12 flex justify-center">
          <div className="w-full max-w-[340px] rounded-xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
            <p className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Receipt
            </p>
            <p
              id="txn-detail-title"
              className="text-center text-sm font-medium text-slate-600 mt-2"
            >
              {directionWithIcon(txn.directionLabel)}
            </p>
            <p className="text-center text-xs text-slate-500 mt-1">
              {txn.typeLabel}
            </p>

            <div className="mt-6 text-center">
              <p
                className={`text-4xl font-bold tabular-nums tracking-tight ${
                  txn.outflow ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {txn.outflow ? "−" : "+"}${absAmount}
              </p>
            </div>

            <div className="mt-5 flex justify-center">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusBadgeClasses(
                  statusDisplay
                )}`}
              >
                {statusDisplay}
              </span>
            </div>

            <div className="mt-6 border-t border-dashed border-slate-200 pt-5 space-y-0 divide-y divide-slate-100">
              <ReceiptRow label="Date & time">
                {formatDetailTimestamp(txn.created_at)}
              </ReceiptRow>
              <ReceiptRow label="Sender" emphasize>
                {senderName}
              </ReceiptRow>
              <ReceiptRow label="Recipient" emphasize>
                {recipientName}
              </ReceiptRow>
              <ReceiptRow label="Transaction ID">
                <span className="font-mono text-xs break-all text-slate-600 leading-relaxed">
                  {idStr}
                </span>
              </ReceiptRow>
              {note ? (
                <ReceiptRow label="Note">
                  <span className="text-slate-700 whitespace-pre-wrap break-words">
                    {note}
                  </span>
                </ReceiptRow>
              ) : null}
              <ReceiptRow label="Balance after transaction">
                <span className="tabular-nums font-medium text-slate-800">
                  ${formatRunningBalance(txn.runningBalance)}
                </span>
              </ReceiptRow>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              <button
                type="button"
                onClick={copyTransactionId}
                className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors"
              >
                {copyDone ? "Copied!" : "Copy Transaction ID"}
              </button>
              <Link
                href={`/transactions/${encodeURIComponent(idStr)}`}
                onClick={onClose}
                className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors text-center"
              >
                Open full details
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [detailTxn, setDetailTxn] = useState(null);
  const [pulseTxnId, setPulseTxnId] = useState(null);

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return;
      if (!silent) setLoading(true);

      const { data: txns, error: txnError } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (txnError) {
        console.error("Transaction fetch error:", txnError.message);
        if (!silent) setLoading(false);
        return;
      }

      setTransactions(txns || []);

      const userIds = [
        ...new Set((txns || []).flatMap((txn) => [txn.sender_id, txn.recipient_id])),
      ].filter(Boolean);

      if (userIds.length === 0) {
        setProfiles({});
        if (!silent) setLoading(false);
        return;
      }

      const { data: usersData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profileError) {
        console.error("Profile fetch error:", profileError.message);
        if (!silent) setLoading(false);
        return;
      }

      const profileMap = {};
      (usersData || []).forEach((p) => {
        const label =
          p.full_name?.trim() || p.email?.trim() || p.id;
        profileMap[p.id] = label;
      });
      setProfiles(profileMap);

      if (!silent) setLoading(false);
    },
    [user?.id]
  );

  useEffect(() => {
    if (!detailTxn) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailTxn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailTxn]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setLoading(false);
      setTransactions([]);
      setProfiles({});
      return;
    }

    fetchData({ silent: false });
  }, [user?.id, authLoading, fetchData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`transactions-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          if (row.sender_id !== user.id && row.recipient_id !== user.id) return;
          setPulseTxnId(row.id);
          fetchData({ silent: true });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Realtime subscription:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  useEffect(() => {
    if (pulseTxnId == null) return;
    const t = setTimeout(() => setPulseTxnId(null), 2600);
    return () => clearTimeout(t);
  }, [pulseTxnId]);

  const profileNames = useMemo(() => {
    const m = { ...profiles };
    if (user?.id) {
      m[user.id] =
        profile?.full_name?.trim() ||
        profile?.email?.trim() ||
        "You";
    }
    return m;
  }, [profiles, user?.id, profile?.full_name, profile?.email]);

  const enriched = useMemo(() => {
    if (!user?.id) return [];
    return (transactions || []).map((txn) =>
      enrichTransaction(txn, user.id, profileNames)
    );
  }, [transactions, user?.id, profileNames]);

  const enrichedWithRunning = useMemo(
    () => attachRunningBalances(enriched),
    [enriched]
  );

  const summary = useMemo(() => {
    let sent = 0;
    let received = 0;
    enriched.forEach((t) => {
      if (t.category === "sent" || t.category === "withdrawn") {
        sent += Number(t.amount) || 0;
      }
      if (t.category === "received" || t.category === "funded") {
        received += Number(t.amount) || 0;
      }
    });
    return {
      total: enriched.length,
      sent,
      received,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    if (filter === "all") return enrichedWithRunning;
    return enrichedWithRunning.filter((t) => t.category === filter);
  }, [enrichedWithRunning, filter]);

  const groupedSections = useMemo(() => {
    const buckets = { today: [], yesterday: [], earlier: [] };
    for (const t of filtered) {
      buckets[dateGroupKey(t.created_at)].push(t);
    }
    return [
      { key: "today", label: "Today", items: buckets.today },
      { key: "yesterday", label: "Yesterday", items: buckets.yesterday },
      { key: "earlier", label: "Earlier", items: buckets.earlier },
    ].filter((s) => s.items.length > 0);
  }, [filtered]);

  const receiptOpenedRef = useRef(null);

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.receipt;
    const receiptId = Array.isArray(raw) ? raw[0] : raw;
    if (!receiptId || typeof receiptId !== "string") {
      receiptOpenedRef.current = null;
      return;
    }
    if (!user?.id || loading || authLoading) return;
    if (receiptOpenedRef.current === receiptId) return;

    const found = enrichedWithRunning.find((t) => String(t.id) === receiptId);
    if (found) {
      receiptOpenedRef.current = receiptId;
      setDetailTxn(found);
      setPulseTxnId(found.id);
      router.replace("/transactions", undefined, { shallow: true });
    }
  }, [
    router,
    router.isReady,
    router.query.receipt,
    enrichedWithRunning,
    loading,
    authLoading,
    user?.id,
  ]);

  if (!authLoading && !user) {
    return (
      <>
        <Navbar />
        <div className="p-6 max-w-2xl mx-auto pb-12">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Transaction history
          </h2>
          <p className="text-slate-600 mt-4">Sign in to view your activity.</p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  const showLoading = authLoading || loading;

  const filterBtn = (active) =>
    `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
      active
        ? "bg-slate-800 text-white border-slate-800"
        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
    }`;

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-2xl mx-auto pb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Transaction history
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Your wallet activity, newest first.
        </p>
      </div>

      {showLoading ? (
        <p className="text-slate-600">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Total transactions
              </p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {summary.total}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Total sent
              </p>
              <p className="text-2xl font-semibold text-red-600 mt-1">
                ${summary.sent.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Total received
              </p>
              <p className="text-2xl font-semibold text-emerald-600 mt-1">
                ${summary.received.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={filterBtn(filter === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center">
              <p className="text-slate-700 font-medium">No activity yet</p>
              <p className="text-sm text-slate-500 mt-2">
                When you fund your wallet, send money, or withdraw, it will
                show up here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
              <p className="text-slate-700 font-medium">
                No transactions in this category
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Try another filter or view All.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedSections.map((section) => (
                <div key={section.key}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                    {section.label}
                  </h3>
                  <ul className="space-y-3">
                    {section.items.map((txn) => (
                      <li
                        key={txn.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailTxn(txn)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailTxn(txn);
                          }
                        }}
                        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer transition hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                          String(pulseTxnId) === String(txn.id)
                            ? "ring-2 ring-amber-400/70 ring-inset bg-amber-50/60"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between gap-3 items-start">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {directionWithIcon(txn.directionLabel)}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                {txn.typeLabel}
                              </span>
                              {txn.statusLabel && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium">
                                  {txn.statusLabel}
                                </span>
                              )}
                            </div>
                            {txn.counterparty && (
                              <p className="text-sm text-slate-600 mt-1 truncate">
                                {txn.directionLabel === "Sent"
                                  ? `To ${txn.counterparty}`
                                  : txn.directionLabel === "Received"
                                    ? `From ${txn.counterparty}`
                                    : txn.counterparty}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">
                              {txn.whenLabel}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 tabular-nums">
                              Balance after: $
                              {Number(txn.runningBalance).toFixed(2)}
                            </p>
                          </div>
                          <div
                            className={`text-lg font-bold tabular-nums shrink-0 ${
                              txn.outflow ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {txn.amountStr}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailTxn && user?.id && (
        <TransactionDetailModal
          txn={detailTxn}
          onClose={() => setDetailTxn(null)}
          userId={user.id}
          profileNames={profileNames}
        />
      )}
    </div>
    </>
  );
}
