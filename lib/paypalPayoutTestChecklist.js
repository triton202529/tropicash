/**
 * Phase 13F: PayPal Payout sandbox end-to-end test checklist (read-only).
 * Does not trigger payouts, create withdrawals, or modify balances.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { fetchProductionAudit, AUDIT_STATUS } from "./productionAudit";
import {
  buildPayPalPayoutReadiness,
  getPublicPayPalPayoutReadiness,
} from "./paypalPayoutReadiness";
import { fetchWithdrawalReconciliationReport } from "./withdrawalReconciliation";

export const CHECKLIST_ITEM_STATUS = Object.freeze({
  READY: "ready",
  PARTIAL: "partial",
  MISSING: "missing",
  MANUAL: "manual",
});

export const CHECKLIST_SECTION_IDS = Object.freeze([
  "environment_readiness",
  "supabase_migration_readiness",
  "test_user_readiness",
  "withdrawal_request_readiness",
  "admin_payout_action",
  "paypal_response_verification",
  "webhook_reconciliation_verification",
  "transaction_ledger_verification",
  "refund_failure_fallback",
]);

/** Env var names only — never values. */
export const REQUIRED_PAYOUT_ENV_VARS = Object.freeze([
  "NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT",
  "NEXT_PUBLIC_PAYPAL_MODE",
  "PAYPAL_MODE",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYPAL_PAYOUTS_SENDER_EMAIL (optional)",
]);

export const SANDBOX_TEST_SEQUENCE = Object.freeze([
  {
    step: "A",
    title: "Confirm environment",
    bullets: [
      "NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT=true",
      "PAYPAL_MODE=sandbox (and NEXT_PUBLIC_PAYPAL_MODE=sandbox)",
      "PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET configured on server",
      "PayPal Payouts enabled on sandbox business account",
    ],
  },
  {
    step: "B",
    title: "Prepare test user",
    bullets: [
      "User has a verified/default payout PayPal email on file",
      "User wallet balance covers a small test amount (e.g. $1–5)",
      "KYC / withdrawal limits allow the test amount",
      "Use a dedicated sandbox test account — not production users",
    ],
  },
  {
    step: "C",
    title: "Create withdrawal (user path)",
    bullets: [
      "User submits withdrawal at /withdraw-wallet",
      "Request appears pending in /admin/withdrawals",
      "Wallet debited; withdraw_wallet transaction in /transactions",
      "withdrawal_transaction_id linked on the request (Phase 13D)",
    ],
  },
  {
    step: "D",
    title: "Admin sends payout (manual click only)",
    bullets: [
      "Open /admin/withdrawals — confirm readiness panel shows Available",
      "Click Send payout (PayPal) on the pending request",
      "Record processor_batch_id and API response message",
      "Status becomes processing or paid — never auto-triggered from this checklist",
    ],
  },
  {
    step: "E",
    title: "Verify settlement",
    bullets: [
      "If webhooks configured: confirm status update from PayPal webhook",
      "Use Check status / reconcile on admin withdrawals if still processing",
      "Final status should be paid or failed with failure_reason",
      "Review /admin/withdrawal-reconciliation for stuck items",
    ],
  },
  {
    step: "F",
    title: "If failed — refund fallback",
    bullets: [
      "Confirm failure_reason visible on withdrawal card",
      "Use Refund wallet when status is failed and not refunded",
      "Verify withdrawal_refund transaction in user history",
      "Re-run withdrawal reconciliation — no critical failed_not_refunded",
    ],
  },
]);

/**
 * @param {{ id: string; label: string; status: string; notes?: string; nextAction?: string }} args
 */
function item({ id, label, status, notes = "", nextAction = "" }) {
  return { id, label, status, notes, nextAction };
}

function auditStatusToChecklist(status) {
  if (status === AUDIT_STATUS.READY) return CHECKLIST_ITEM_STATUS.READY;
  if (status === AUDIT_STATUS.PARTIAL) return CHECKLIST_ITEM_STATUS.PARTIAL;
  return CHECKLIST_ITEM_STATUS.MISSING;
}

function readinessStatusToChecklist(status) {
  const s = String(status || "").toLowerCase();
  if (s === "ready") return CHECKLIST_ITEM_STATUS.READY;
  if (s === "partial") return CHECKLIST_ITEM_STATUS.PARTIAL;
  return CHECKLIST_ITEM_STATUS.MISSING;
}

async function probeWithdrawalSchema(supabase) {
  const { error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, status, withdrawal_transaction_id, refunded_at, refund_transaction_id, processor_batch_id, manual_payout_reference",
    )
    .limit(1);
  if (!error) return { ok: true, detail: "Phase 13B–13D columns reachable." };
  const msg = String(error.message || "").toLowerCase();
  if (msg.includes("withdrawal_transaction_id") || msg.includes("refunded_at") || error.code === "PGRST204") {
    return { ok: false, detail: "Missing columns — apply phase_13b/13c/13d SQL migrations." };
  }
  if (msg.includes("does not exist") || error.code === "42P01") {
    return { ok: false, detail: "withdrawal_requests table not reachable." };
  }
  return { ok: false, detail: error.message || "Schema probe failed." };
}

async function probeTransactionTypes(supabase) {
  const { error } = await supabase
    .from("transactions")
    .select("id, type")
    .in("type", ["withdraw_wallet", "withdrawal_refund"])
    .limit(1);
  if (!error) return { ok: true, detail: "withdraw_wallet / withdrawal_refund types queryable." };
  const msg = String(error.message || "").toLowerCase();
  if (msg.includes("transactions_type_check") || msg.includes("check constraint")) {
    return { ok: false, detail: "Apply phase_13c/13d transactions type CHECK for withdrawal_refund." };
  }
  return { ok: false, detail: error.message || "Transactions probe failed." };
}

/**
 * @param {{
 *   supabase?: import('@supabase/supabase-js').SupabaseClient;
 *   serverPayoutReadiness?: ReturnType<typeof import('./paypalPayoutReadiness').getServerPayPalPayoutReadiness> | null;
 * }} [opts]
 */
export async function fetchPayPalPayoutTestChecklist(opts = {}) {
  const supabase = opts.supabase || defaultClient;
  const publicPart = getPublicPayPalPayoutReadiness();
  const payoutReadiness = buildPayPalPayoutReadiness(publicPart, opts.serverPayoutReadiness ?? null);

  const [productionAudit, reconciliation, schemaProbe, txnProbe] = await Promise.all([
    fetchProductionAudit({ supabase }).catch(() => null),
    fetchWithdrawalReconciliationReport({ supabase }).catch(() => null),
    probeWithdrawalSchema(supabase),
    probeTransactionTypes(supabase),
  ]);

  const paypalAuditSection = productionAudit?.sections?.find((s) => s.id === "paypal_configuration");
  const envAuditSection = productionAudit?.sections?.find((s) => s.id === "environment_variables");
  const isSandbox =
    payoutReadiness.mode === "sandbox" ||
    (publicPart.publicMode === "sandbox" && payoutReadiness.mode !== "live");

  const sections = [];

  // 1. Environment readiness
  sections.push({
    id: "environment_readiness",
    title: "Environment readiness",
    description: "Automated presence checks only — secret values are never shown.",
    items: [
      item({
        id: "env_automation_flag",
        label: "NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT=true",
        status: publicPart.automationEnabled ? CHECKLIST_ITEM_STATUS.READY : CHECKLIST_ITEM_STATUS.MISSING,
        notes: publicPart.automationEnabled
          ? "Automated payout feature flag is on."
          : "Send payout (PayPal) stays disabled until true.",
        nextAction: publicPart.automationEnabled
          ? "Proceed to sandbox mode check."
          : "Set flag in .env.local and redeploy; re-check /admin/withdrawals readiness panel.",
      }),
      item({
        id: "env_sandbox_mode",
        label: "PayPal mode is sandbox (required for this test)",
        status: isSandbox
          ? CHECKLIST_ITEM_STATUS.READY
          : payoutReadiness.mode === "live"
            ? CHECKLIST_ITEM_STATUS.MISSING
            : CHECKLIST_ITEM_STATUS.PARTIAL,
        notes: `Detected mode: ${payoutReadiness.mode}. This checklist is sandbox-only.`,
        nextAction: isSandbox
          ? "Do not switch to live until sandbox E2E passes."
          : "Set PAYPAL_MODE=sandbox and NEXT_PUBLIC_PAYPAL_MODE=sandbox. Never run this test in live mode.",
      }),
      item({
        id: "env_server_credentials",
        label: "Server PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET",
        status:
          payoutReadiness.serverCredentialsReady && opts.serverPayoutReadiness != null
            ? CHECKLIST_ITEM_STATUS.READY
            : opts.serverPayoutReadiness == null
              ? CHECKLIST_ITEM_STATUS.PARTIAL
              : CHECKLIST_ITEM_STATUS.MISSING,
        notes: opts.serverPayoutReadiness == null
          ? "Server probe not loaded — open checklist while signed in as admin to refresh."
          : payoutReadiness.serverCredentialsReady
            ? "Server credentials present (values not shown)."
            : payoutReadiness.blockers.join(" "),
        nextAction: "Confirm server env in deployment host; use /admin/withdrawals Re-check env.",
      }),
      item({
        id: "env_paypal_payouts_product",
        label: "PayPal Payouts enabled on sandbox merchant account",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Must be enabled in PayPal Developer / sandbox business profile.",
        nextAction: "In PayPal sandbox dashboard, confirm Payouts product is active for the sender account.",
      }),
      ...(paypalAuditSection?.items || []).slice(0, 2).map((auditItem) =>
        item({
          id: `audit_${auditItem.id}`,
          label: auditItem.label,
          status: auditStatusToChecklist(auditItem.status),
          notes: auditItem.notes || auditItem.detail || "",
          nextAction: auditItem.recommendedAction || "",
        }),
      ),
    ],
  });

  // 2. Supabase migration readiness
  sections.push({
    id: "supabase_migration_readiness",
    title: "Supabase migration readiness",
    description: "Schema probes for Phases 13B–13D and payout columns.",
    items: [
      item({
        id: "schema_withdrawal_requests",
        label: "withdrawal_requests payout + refund + ledger columns",
        status: schemaProbe.ok ? CHECKLIST_ITEM_STATUS.READY : CHECKLIST_ITEM_STATUS.MISSING,
        notes: schemaProbe.detail,
        nextAction: schemaProbe.ok
          ? "Schema ready for test."
          : "Run phase_13b_manual_payout_confirmation.sql, phase_13c_withdrawal_refunds.sql, phase_13d_withdrawal_transaction_ledger.sql.",
      }),
      item({
        id: "schema_transaction_types",
        label: "transactions supports withdraw_wallet + withdrawal_refund",
        status: txnProbe.ok ? CHECKLIST_ITEM_STATUS.READY : CHECKLIST_ITEM_STATUS.MISSING,
        notes: txnProbe.detail,
        nextAction: txnProbe.ok ? "Ledger logging ready." : "Apply phase_13c/13d type CHECK migrations.",
      }),
      item({
        id: "schema_create_withdrawal_rpc",
        label: "create_withdrawal_request RPC (wallet debit + ledger)",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "RPC should insert withdraw_wallet transaction per Phase 13D.",
        nextAction: "Apply create_withdrawal_request_rpc.sql / phase_13d in Supabase SQL editor.",
      }),
      item({
        id: "schema_refund_rpc",
        label: "refund_withdrawal_request RPC (Phase 13C)",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Required for failed/rejected refund path in step F.",
        nextAction: "Apply phase_13c_withdrawal_refunds.sql before testing refunds.",
      }),
    ],
  });

  // 3. Test user readiness
  sections.push({
    id: "test_user_readiness",
    title: "Test user readiness",
    description: "Manual preparation before creating a test withdrawal.",
    items: [
      item({
        id: "user_payout_email",
        label: "Test user has payout PayPal email on file",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Must match a sandbox PayPal receiver account.",
        nextAction: "Fund test user profile; use sandbox personal/business email for payout destination.",
      }),
      item({
        id: "user_wallet_balance",
        label: "Test user has sufficient wallet balance",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Use a small amount ($1–5 sandbox).",
        nextAction: "Fund wallet via sandbox PayPal funding flow if needed.",
      }),
      item({
        id: "user_kyc_withdrawal",
        label: "KYC / limits allow withdrawal",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Server gate: POST /api/withdrawals/check-limit.",
        nextAction: "Confirm KYC status and daily limits on /admin/kyc-limits if blocked.",
      }),
    ],
  });

  // 4. Withdrawal request readiness
  sections.push({
    id: "withdrawal_request_readiness",
    title: "Withdrawal request readiness",
    description: "After user submits — verify in admin queue and ledger.",
    items: [
      item({
        id: "wr_pending_visible",
        label: "Pending request visible in /admin/withdrawals",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Status: Pending review.",
        nextAction: "User submits at /withdraw-wallet; refresh admin queue.",
      }),
      item({
        id: "wr_wallet_debit_txn",
        label: "withdraw_wallet transaction in user history",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Label: Withdrawal request (outgoing).",
        nextAction: "Check /transactions for test user after submit.",
      }),
      item({
        id: "wr_withdrawal_transaction_id",
        label: "withdrawal_transaction_id linked on request",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Phase 13D ledger link.",
        nextAction: "On request detail in admin, confirm ledger txn ID or run phase_13d backfill.",
      }),
    ],
  });

  // 5. Admin payout action
  sections.push({
    id: "admin_payout_action",
    title: "Admin payout action",
    description: "Manual admin trigger only — this checklist never sends payouts.",
    items: [
      item({
        id: "admin_readiness_panel",
        label: "PayPal Payout readiness panel shows Available",
        status: payoutReadiness.payoutActionAvailable
          ? CHECKLIST_ITEM_STATUS.READY
          : CHECKLIST_ITEM_STATUS.MISSING,
        notes: payoutReadiness.payoutActionAvailable
          ? "Send payout (PayPal) button should be enabled for pending requests."
          : payoutReadiness.blockers[0] || "Payout action unavailable.",
        nextAction: "Fix env blockers on /admin/withdrawals before clicking Send payout.",
      }),
      item({
        id: "admin_send_payout_click",
        label: "Admin clicks Send payout (PayPal) once",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Requires explicit confirmation dialog on admin page.",
        nextAction: "Record batch ID from success banner; do not retry unless failed.",
      }),
      item({
        id: "admin_status_processing_or_paid",
        label: "Status becomes processing or paid",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Processing — PayPal batch sent, or Paid — PayPal confirmed.",
        nextAction: "If still pending after click, check API error banner on withdrawals page.",
      }),
    ],
  });

  // 6. PayPal response verification
  sections.push({
    id: "paypal_response_verification",
    title: "PayPal response verification",
    description: "Record provider response for audit — no secrets in UI.",
    items: [
      item({
        id: "paypal_batch_id",
        label: "processor_batch_id stored on withdrawal",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Visible on admin withdrawal card after Send payout.",
        nextAction: "Copy batch ID to test notes; match in PayPal sandbox activity.",
      }),
      item({
        id: "paypal_processor_response",
        label: "processor_response / processor_status populated",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Audit fields from payout API.",
        nextAction: "Expand failure details if status is failed.",
      }),
      item({
        id: "paypal_sandbox_activity",
        label: "Payout visible in PayPal sandbox dashboard",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "External verification.",
        nextAction: "Log into sandbox.paypal.com → Activity → Payouts.",
      }),
    ],
  });

  // 7. Webhook / reconciliation
  sections.push({
    id: "webhook_reconciliation_verification",
    title: "Webhook / reconciliation verification",
    description: "Confirm final status via webhook or admin reconcile.",
    items: [
      item({
        id: "webhook_configured",
        label: "PayPal webhook endpoint configured (optional)",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "/api/webhooks/paypal — may update processing → paid.",
        nextAction: "If webhooks not wired, use Check status button on admin withdrawals.",
      }),
      item({
        id: "admin_reconcile_poll",
        label: "Check status / reconcile action tested",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Polls PayPal batch when processing.",
        nextAction: "On processing request, click Check status; confirm paid or failed.",
      }),
      item({
        id: "recon_no_stuck_processing",
        label: "No processing_paypal_stale in reconciliation",
        status:
          (reconciliation?.summary?.byType?.processing_paypal_stale ?? 0) === 0
            ? CHECKLIST_ITEM_STATUS.READY
            : CHECKLIST_ITEM_STATUS.PARTIAL,
        notes:
          reconciliation?.summary != null
            ? `Stuck processing issues: ${reconciliation.summary.byType?.processing_paypal_stale ?? 0}`
            : "Reconciliation report not loaded.",
        nextAction: "Review /admin/withdrawal-reconciliation after test.",
      }),
    ],
  });

  // 8. Transaction ledger
  const missingLedger =
    reconciliation?.summary?.byType?.missing_withdrawal_transaction_id ?? null;
  sections.push({
    id: "transaction_ledger_verification",
    title: "Transaction ledger verification",
    description: "Wallet debit, payout status, and ledger consistency.",
    items: [
      item({
        id: "ledger_debit_matches_request",
        label: "withdraw_wallet amount matches withdrawal request",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Compare /transactions with request amount.",
        nextAction: "Open transaction detail; confirm linked withdrawal status line.",
      }),
      item({
        id: "ledger_no_orphans",
        label: "No orphan withdraw/refund transactions",
        status:
          missingLedger === null
            ? CHECKLIST_ITEM_STATUS.PARTIAL
            : (reconciliation?.summary?.byType?.orphan_withdraw_transaction ?? 0) +
                  (reconciliation?.summary?.byType?.orphan_refund_transaction ?? 0) ===
                0
              ? CHECKLIST_ITEM_STATUS.READY
              : CHECKLIST_ITEM_STATUS.PARTIAL,
        notes:
          reconciliation?.summary != null
            ? `Orphan withdraw: ${reconciliation.summary.byType?.orphan_withdraw_transaction ?? 0} · orphan refund: ${reconciliation.summary.byType?.orphan_refund_transaction ?? 0}`
            : "Run reconciliation after test.",
        nextAction: "Fix via phase_13d backfill if missing_withdrawal_transaction_id issues appear.",
      }),
      item({
        id: "ledger_reconciliation_clean",
        label: "Withdrawal reconciliation has zero critical issues",
        status:
          reconciliation?.summary?.critical === 0
            ? CHECKLIST_ITEM_STATUS.READY
            : (reconciliation?.summary?.critical ?? 0) > 0
              ? CHECKLIST_ITEM_STATUS.MISSING
              : CHECKLIST_ITEM_STATUS.PARTIAL,
        notes:
          reconciliation?.summary != null
            ? `Critical: ${reconciliation.summary.critical} · Total: ${reconciliation.summary.total}`
            : "Load reconciliation report.",
        nextAction: "Open /admin/withdrawal-reconciliation and resolve critical items.",
      }),
    ],
  });

  // 9. Refund / failure fallback
  const failedNotRefunded = reconciliation?.summary?.byType?.failed_not_refunded ?? null;
  sections.push({
    id: "refund_failure_fallback",
    title: "Refund / failure fallback",
    description: "Only if sandbox payout fails — manual refund path.",
    items: [
      item({
        id: "failure_reason_visible",
        label: "failure_reason visible on failed withdrawal",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Failed — PayPal error label in admin.",
        nextAction: "Use PayPal error panel on withdrawal card for diagnosis.",
      }),
      item({
        id: "refund_action_available",
        label: "Refund wallet action available when failed + not refunded",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Phase 13C — idempotent refund API.",
        nextAction: "Click Refund wallet on failed request; confirm success banner.",
      }),
      item({
        id: "refund_ledger_txn",
        label: "withdrawal_refund transaction in user history",
        status: CHECKLIST_ITEM_STATUS.MANUAL,
        notes: "Incoming credit labeled Withdrawal refund.",
        nextAction: "Verify on /transactions for test user.",
      }),
      item({
        id: "no_failed_unrefunded",
        label: "No failed_not_refunded reconciliation issues",
        status:
          failedNotRefunded === null
            ? CHECKLIST_ITEM_STATUS.PARTIAL
            : failedNotRefunded === 0
              ? CHECKLIST_ITEM_STATUS.READY
              : CHECKLIST_ITEM_STATUS.MISSING,
        notes:
          failedNotRefunded != null ? `Open failed-not-refunded: ${failedNotRefunded}` : "Check after refund test.",
        nextAction: "Ensure every failed sandbox test is refunded or intentionally retained for review.",
      }),
    ],
  });

  let ready = 0;
  let partial = 0;
  let missing = 0;
  let manual = 0;
  for (const section of sections) {
    for (const row of section.items) {
      if (row.status === CHECKLIST_ITEM_STATUS.READY) ready += 1;
      else if (row.status === CHECKLIST_ITEM_STATUS.PARTIAL) partial += 1;
      else if (row.status === CHECKLIST_ITEM_STATUS.MANUAL) manual += 1;
      else missing += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    sandboxOnly: true,
    doesNotTriggerPayouts: true,
    payoutReadiness,
    productionAuditSummary: productionAudit?.summary ?? null,
    reconciliationSummary: reconciliation?.summary ?? null,
    envAuditPaypal: envAuditSection?.items?.filter((i) => String(i.id).includes("paypal")) ?? [],
    summary: {
      ready,
      partial,
      missing,
      manual,
      total: ready + partial + missing + manual,
      automatedReady: ready,
      requiresManualSteps: manual,
    },
    sections,
    testSequence: SANDBOX_TEST_SEQUENCE,
    requiredEnvVars: REQUIRED_PAYOUT_ENV_VARS,
    links: {
      withdrawals: "/admin/withdrawals",
      reconciliation: "/admin/withdrawal-reconciliation",
      productionAudit: "/admin/production-audit",
      transactions: "/transactions",
    },
  };
}

export function checklistStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === CHECKLIST_ITEM_STATUS.READY) return "Ready";
  if (key === CHECKLIST_ITEM_STATUS.PARTIAL) return "Partial";
  if (key === CHECKLIST_ITEM_STATUS.MANUAL) return "Manual step";
  if (key === CHECKLIST_ITEM_STATUS.MISSING) return "Missing";
  return "Unknown";
}

export function checklistStatusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === CHECKLIST_ITEM_STATUS.READY) return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  if (key === CHECKLIST_ITEM_STATUS.PARTIAL) return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  if (key === CHECKLIST_ITEM_STATUS.MANUAL) return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
  return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
}
