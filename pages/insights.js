import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

const sectionCard = "tropicash-surface rounded-xl p-4 sm:p-5";

function formatMoney(value) {
  const amount = Number(value);
  return Number(Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeType(type) {
  const raw = String(type || "").toLowerCase();
  if (raw === "send_money" || raw === "money_sent") return "send";
  if (raw === "receive_money" || raw === "money_received") return "receive";
  if (raw === "fund_wallet" || raw === "wallet_funded" || raw === "fund") return "fund";
  if (raw === "withdraw_wallet" || raw === "withdraw") return "withdraw";
  return raw;
}

/**
 * Per-user monetary effect for insights (no DB writes).
 * Returns contribution to category totals and in/out buckets for charts.
 */
function effectForUser(txn, userId) {
  const type = normalizeType(txn.type);
  const amount = Number(txn.amount) || 0;
  const senderId = txn.sender_id || null;
  const recipientId = txn.recipient_id || null;
  const isSender = senderId === userId;
  const isRecipient = recipientId === userId;
  const isSelf = senderId && recipientId && senderId === userId && recipientId === userId;

  const out = { send: 0, withdraw: 0, moneyOut: 0 };
  const inn = { receive: 0, fund: 0, moneyIn: 0 };

  if (type === "withdraw") {
    out.withdraw = amount;
    out.moneyOut = amount;
    return { out, inn, primary: "withdraw" };
  }
  if (type === "fund") {
    inn.fund = amount;
    inn.moneyIn = amount;
    return { out, inn, primary: "fund" };
  }
  if (type === "send") {
    if (isSelf) return { out, inn, primary: null };
    if (isSender && !isRecipient) {
      out.send = amount;
      out.moneyOut = amount;
      return { out, inn, primary: "send" };
    }
    if (isRecipient && !isSender) {
      inn.receive = amount;
      inn.moneyIn = amount;
      return { out, inn, primary: "receive" };
    }
    return { out, inn, primary: null };
  }
  if (type === "receive") {
    inn.receive = amount;
    inn.moneyIn = amount;
    return { out, inn, primary: "receive" };
  }
  return { out, inn, primary: null };
}

function sumEffects(rows, userId) {
  const totals = {
    totalSent: 0,
    totalReceived: 0,
    totalFunded: 0,
    totalWithdrawn: 0,
    breakdown: { send: 0, receive: 0, fund: 0, withdraw: 0 },
  };

  (rows || []).forEach((txn) => {
    const { out, inn } = effectForUser(txn, userId);
    totals.totalSent += out.send;
    totals.totalReceived += inn.receive;
    totals.totalFunded += inn.fund;
    totals.totalWithdrawn += out.withdraw;
    totals.breakdown.send += out.send;
    totals.breakdown.receive += inn.receive;
    totals.breakdown.fund += inn.fund;
    totals.breakdown.withdraw += out.withdraw;
  });

  const moneyIn = totals.totalReceived + totals.totalFunded;
  const moneyOut = totals.totalSent + totals.totalWithdrawn;
  const netFlow = moneyIn - moneyOut;

  return { ...totals, moneyIn, moneyOut, netFlow };
}

function mondayOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function toDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildChartBuckets(rows, userId, mode) {
  const map = new Map();

  (rows || []).forEach((txn) => {
    const created = txn.created_at ? new Date(txn.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) return;

    let key;
    let label;
    if (mode === "week") {
      const m = mondayOfWeek(created);
      key = toDayKey(m);
      label = m.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } else {
      const day = new Date(created.getFullYear(), created.getMonth(), created.getDate());
      key = toDayKey(day);
      label = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    const { inn, out } = effectForUser(txn, userId);
    const cur = map.get(key) || { key, label, moneyIn: 0, moneyOut: 0 };
    cur.moneyIn += inn.moneyIn;
    cur.moneyOut += out.moneyOut;
    cur.label = label;
    map.set(key, cur);
  });

  const now = new Date();
  const buckets = [];
  const n = mode === "week" ? 10 : 14;

  if (mode === "week") {
    const anchor = mondayOfWeek(now);
    for (let i = n - 1; i >= 0; i -= 1) {
      const m = new Date(anchor);
      m.setDate(m.getDate() - i * 7);
      const key = toDayKey(m);
      const b = map.get(key) || {
        key,
        label: m.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        moneyIn: 0,
        moneyOut: 0,
      };
      buckets.push(b);
    }
  } else {
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const key = toDayKey(day);
      const b = map.get(key) || {
        key,
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        moneyIn: 0,
        moneyOut: 0,
      };
      buckets.push(b);
    }
  }

  return buckets;
}

function shortActivityLine(txn, userId) {
  const type = normalizeType(txn.type);
  const amt = formatMoney(txn.amount);
  const { inn, out } = effectForUser(txn, userId);
  const when = formatShortWhen(txn.created_at);

  if (out.withdraw > 0) return { line: `Withdraw $${amt}`, tone: "out", when };
  if (inn.fund > 0) return { line: `Fund $${amt}`, tone: "in", when };
  if (out.send > 0) return { line: `Send $${amt}`, tone: "out", when };
  if (inn.receive > 0) return { line: `Receive $${amt}`, tone: "in", when };
  if (type === "send" && inn.moneyIn === 0 && out.moneyOut === 0) return { line: `Activity · $${amt}`, tone: "neutral", when };
  return { line: `${String(txn.type || "Txn").replace(/_/g, " ")} · $${amt}`, tone: "neutral", when };
}

const CHART_PX = 112;

function SimpleFlowChart({ buckets, mode }) {
  const maxVal = useMemo(() => {
    let m = 0;
    buckets.forEach((b) => {
      m = Math.max(m, b.moneyIn, b.moneyOut);
    });
    return m > 0 ? m : 1;
  }, [buckets]);

  if (!buckets.length) return null;

  return (
    <div className="mt-3">
      <div className="flex h-[148px] items-end gap-0.5 sm:gap-1" role="img" aria-label="Activity by period">
        {buckets.map((b) => {
          const net = b.moneyIn - b.moneyOut;
          const inPx = maxVal > 0 ? (b.moneyIn / maxVal) * CHART_PX : 0;
          const outPx = maxVal > 0 ? (b.moneyOut / maxVal) * CHART_PX : 0;
          const inH = b.moneyIn > 0 ? Math.max(3, inPx) : 0;
          const outH = b.moneyOut > 0 ? Math.max(3, outPx) : 0;
          const labelShort =
            mode === "week"
              ? b.label
              : new Date(b.key + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
          return (
            <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className="flex w-full max-w-[26px] flex-col justify-end gap-px self-center sm:max-w-none"
                style={{ height: CHART_PX }}
                title={`In $${formatMoney(b.moneyIn)} · Out $${formatMoney(b.moneyOut)}`}
              >
                <div className="w-full rounded-t bg-emerald-500/90" style={{ height: inH }} />
                <div className="w-full rounded-b bg-rose-500/90" style={{ height: outH }} />
              </div>
              <span
                className="mt-1 max-w-full truncate text-center text-[0.6rem] font-medium text-slate-500 sm:text-[0.65rem]"
                title={mode === "week" ? `Week of ${b.label}` : b.label}
              >
                {labelShort}
              </span>
              <span
                className={`max-w-full truncate text-center text-[0.55rem] font-semibold tabular-nums sm:text-[0.6rem] ${
                  net > 0 ? "text-emerald-700" : net < 0 ? "text-rose-700" : "text-slate-400"
                }`}
                title={`Net $${formatMoney(net)}`}
              >
                {net === 0 ? "—" : `${net > 0 ? "+" : "−"}$${formatMoney(Math.abs(net))}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Money in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-rose-500" /> Money out
        </span>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { user, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [chartMode, setChartMode] = useState("day");

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMsg("");
      const { data: txns, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[insights] fetch failed:", error);
        setRows([]);
        setErrorMsg("Could not load insights right now.");
        setLoading(false);
        return;
      }

      setRows(txns || []);
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const stats = useMemo(() => {
    if (!user?.id) return null;
    return sumEffects(rows, user.id);
  }, [rows, user?.id]);

  const chartBuckets = useMemo(() => {
    if (!user?.id) return [];
    return buildChartBuckets(rows, user.id, chartMode === "week" ? "week" : "day");
  }, [rows, user?.id, chartMode]);

  const recentFive = useMemo(() => {
    if (!user?.id) return [];
    return (rows || []).slice(0, 5).map((txn) => ({
      id: txn.id,
      ...shortActivityLine(txn, user.id),
    }));
  }, [rows, user?.id]);

  if (!authLoading && !user) {
    return (
      <>
        <Navbar />
        <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Insights</h1>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">Sign in to view your spending analysis.</p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Go to login
            </Link>
          </div>
        </div>
      </>
    );
  }

  const hasRows = rows.length > 0;

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
            <Image
              src="/tropicash-logo-dark.png"
              alt="Tropicash"
              width={200}
              height={60}
              className="mb-4 h-auto w-[min(200px,55vw)] object-contain"
              priority
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Spending insights</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only analysis from your transactions: money in, money out, category breakdown, and recent activity.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/wallet"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Back to Wallet
              </Link>
              <Link
                href="/transactions"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                View transactions
              </Link>
            </div>
          </div>

          {authLoading || loading ? (
            <div className={`${sectionCard} text-center`}>
              <p className="text-sm font-medium text-slate-700">Loading insights…</p>
            </div>
          ) : errorMsg ? (
            <div className={`${sectionCard} text-center`}>
              <p className="text-sm font-semibold text-slate-900">{errorMsg}</p>
            </div>
          ) : !hasRows ? (
            <div className={`${sectionCard} text-center`}>
              <p className="text-lg font-bold text-slate-900">No activity yet</p>
              <p className="mt-2 text-sm text-slate-600">
                Fund your wallet, send money, or withdraw—your totals and charts will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={sectionCard}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Money In</p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-700 sm:text-2xl">
                    +${formatMoney(stats.moneyIn)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Received ${formatMoney(stats.totalReceived)} + funded ${formatMoney(stats.totalFunded)}
                  </p>
                </div>
                <div className={sectionCard}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Money Out</p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-rose-700 sm:text-2xl">
                    −${formatMoney(stats.moneyOut)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Sent ${formatMoney(stats.totalSent)} + withdrawn ${formatMoney(stats.totalWithdrawn)}
                  </p>
                </div>
                <div className={sectionCard}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Net Flow</p>
                  <p
                    className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${
                      stats.netFlow >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {stats.netFlow >= 0 ? "+" : "−"}${formatMoney(Math.abs(stats.netFlow))}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">Money in minus money out (all time)</p>
                </div>
              </div>

              <div className={sectionCard}>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">By category</h2>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">Totals grouped as send, receive, fund, and withdraw.</p>
                <ul className="mt-4 divide-y divide-slate-100">
                  {[
                    { key: "send", label: "Send", amount: stats.breakdown.send, tone: "text-rose-800" },
                    { key: "receive", label: "Receive", amount: stats.breakdown.receive, tone: "text-emerald-800" },
                    { key: "fund", label: "Fund wallet", amount: stats.breakdown.fund, tone: "text-sky-800" },
                    { key: "withdraw", label: "Withdraw", amount: stats.breakdown.withdraw, tone: "text-amber-900" },
                  ].map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                      <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${row.tone}`}>${formatMoney(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={sectionCard}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">Activity chart</h2>
                    <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Stacked in (green) vs out (rose) per period.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setChartMode("day")}
                      className={`rounded-md px-3 py-1.5 transition ${
                        chartMode === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode("week")}
                      className={`rounded-md px-3 py-1.5 transition ${
                        chartMode === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
                <SimpleFlowChart buckets={chartBuckets} mode={chartMode} />
              </div>

              <div className={sectionCard}>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">Recent activity</h2>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">Latest five transactions.</p>
                <ul className="mt-4 space-y-2">
                  {recentFive.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <span
                        className={`min-w-0 truncate text-sm font-medium ${
                          r.tone === "in" ? "text-emerald-800" : r.tone === "out" ? "text-rose-800" : "text-slate-800"
                        }`}
                      >
                        {r.line}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{r.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <p className="mt-10 text-center text-sm text-slate-500">
            <Link href="/support" className="font-semibold text-blue-700 hover:underline">
              Help &amp; support →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
