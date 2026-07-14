import { FUNDING_EVENTS } from "./fraudRules";

function startOfLocalDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfLocalDayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

const CAPTURE_FAIL_EVENTS = [
  FUNDING_EVENTS.PAYPAL_CAPTURE_FAILED,
  FUNDING_EVENTS.PAYPAL_CAPTURE_INCOMPLETE,
  FUNDING_EVENTS.INVALID_CAPTURE_AMOUNT,
];

/**
 * Read-only admin snapshot for dashboard (no wallet mutations).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export async function fetchAdminOperationalSnapshot(supabase) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dayStart = startOfLocalDayIso();
  const dayEnd = endOfLocalDayIso();

  const [
    pendW,
    procW,
    fraudOpen,
    dupFund24,
    capFail24,
    creditFail24,
    txToday,
    fundRows,
    withdrawRows,
    sendRows,
    allTodayRows,
    fundTxs,
    withdrawTxs,
    fraudRecent,
    wrRecent,
  ] = await Promise.all([
    supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "processing"),
    supabase.from("fraud_logs").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("fraud_logs")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", "fund")
      .eq("event_type", FUNDING_EVENTS.DUPLICATE_BLOCKED)
      .gte("created_at", since24h),
    supabase
      .from("fraud_logs")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", "fund")
      .in("event_type", CAPTURE_FAIL_EVENTS)
      .gte("created_at", since24h),
    supabase
      .from("fraud_logs")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", "fund")
      .eq("event_type", FUNDING_EVENTS.CREDIT_FAILED)
      .gte("created_at", since24h),
    supabase.from("transactions").select("id", { count: "exact", head: true }).gte("created_at", dayStart).lte("created_at", dayEnd),
    supabase
      .from("transactions")
      .select("amount")
      .in("type", ["fund", "fund_wallet", "wallet_funded"])
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(5000),
    supabase
      .from("transactions")
      .select("amount")
      .eq("type", "withdraw_wallet")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(5000),
    supabase
      .from("transactions")
      .select("amount")
      .eq("type", "send_money")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(5000),
    supabase
      .from("transactions")
      .select("amount")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(5000),
    supabase
      .from("transactions")
      .select("id, amount, created_at")
      .in("type", ["fund", "fund_wallet", "wallet_funded"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select("id, amount, created_at")
      .eq("type", "withdraw_wallet")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("fraud_logs")
      .select("id, user_id, event_type, description, risk_level, transaction_type, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("withdrawal_requests")
      .select("id, user_id, amount, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const sumAmount = (rows) =>
    (rows || []).reduce((acc, r) => {
      const n = Number(r?.amount);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

  const volumeToday = (allTodayRows.data || []).reduce((acc, r) => {
    const n = Math.abs(Number(r?.amount));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  const failedFunding24h =
    (typeof dupFund24.count === "number" ? dupFund24.count : 0) +
    (typeof capFail24.count === "number" ? capFail24.count : 0) +
    (typeof creditFail24.count === "number" ? creditFail24.count : 0);

  /** @type {Array<{ id: string; at: string; kind: string; title: string; detail: string; href: string | null }>} */
  const activity = [];

  for (const t of fundTxs.data || []) {
    activity.push({
      id: `fund:${t.id}`,
      at: t.created_at,
      kind: "fund",
      title: "Funding",
      detail: `Wallet funded · $${Number(t.amount || 0).toFixed(2)}`,
      href: `/transactions/${encodeURIComponent(String(t.id))}`,
    });
  }
  for (const t of withdrawTxs.data || []) {
    activity.push({
      id: `wd:${t.id}`,
      at: t.created_at,
      kind: "withdraw",
      title: "Wallet withdrawal",
      detail: `Debit · $${Number(t.amount || 0).toFixed(2)}`,
      href: `/transactions/${encodeURIComponent(String(t.id))}`,
    });
  }
  for (const f of fraudRecent.data || []) {
    const ev = f.event_type ? String(f.event_type) : "fraud log";
    const desc = f.description ? String(f.description).slice(0, 120) : f.risk_level || "";
    activity.push({
      id: `fraud:${f.id}`,
      at: f.created_at,
      kind: "fraud",
      title: "Fraud / risk",
      detail: `${ev}${desc ? ` · ${desc}` : ""}`,
      href: `/admin/fraud/${encodeURIComponent(String(f.id))}`,
    });
  }
  for (const w of wrRecent.data || []) {
    const st = String(w.status || "").toLowerCase();
    activity.push({
      id: `wr:${w.id}`,
      at: w.updated_at || w.created_at,
      kind: "payout",
      title: "Withdrawal request",
      detail: `Status: ${st} · $${Number(w.amount || 0).toFixed(2)}`,
      href: "/admin/withdrawals",
    });
  }

  activity.sort((a, b) => {
    const ta = new Date(a.at || 0).getTime();
    const tb = new Date(b.at || 0).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const firstErr =
    pendW.error ||
    procW.error ||
    fraudOpen.error ||
    dupFund24.error ||
    capFail24.error ||
    creditFail24.error ||
    txToday.error ||
    fundRows.error ||
    withdrawRows.error ||
    sendRows.error ||
    allTodayRows.error ||
    fundTxs.error ||
    withdrawTxs.error ||
    fraudRecent.error ||
    wrRecent.error;

  return {
    error: firstErr ? String(firstErr.message || firstErr) : null,
    kpi: {
      pendingWithdrawals: typeof pendW.count === "number" ? pendW.count : 0,
      processingWithdrawals: typeof procW.count === "number" ? procW.count : 0,
      fraudOpen: typeof fraudOpen.count === "number" ? fraudOpen.count : 0,
      failedFunding24h,
      volumeToday,
      transactionsToday: typeof txToday.count === "number" ? txToday.count : 0,
      fundingFailureBuckets: {
        duplicate24h: typeof dupFund24.count === "number" ? dupFund24.count : 0,
        captureFailures24h: typeof capFail24.count === "number" ? capFail24.count : 0,
        walletCreditFailures24h: typeof creditFail24.count === "number" ? creditFail24.count : 0,
      },
      reconciliation: {
        fundedToday: sumAmount(fundRows.data),
        withdrawnToday: sumAmount(withdrawRows.data),
        sentToday: sumAmount(sendRows.data),
      },
    },
    activity: activity.slice(0, 22),
  };
}
