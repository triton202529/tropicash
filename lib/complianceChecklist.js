/**
 * Phase 11K: Admin compliance release readiness checklist (read-only probes).
 */

import { supabase as defaultClient } from "./supabaseClient";
import { fetchWithdrawalReconciliationReport } from "./withdrawalReconciliation";

export const CHECKLIST_STATUS = Object.freeze({
  READY: "ready",
  PARTIAL: "partial",
  MISSING: "missing",
});

export const CHECKLIST_SECTION_IDS = Object.freeze([
  "kyc",
  "withdrawal",
  "treasury",
  "fraud_risk",
  "security",
  "developer_api",
  "legal",
  "production",
]);

function truncate(text, max = 180) {
  const s = String(text == null ? "" : text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function checklistItem({
  id,
  label,
  status,
  owner = "Engineering",
  notes = "",
  recommendedAction = "",
  detail = "",
}) {
  return {
    id,
    label,
    status,
    owner,
    notes,
    recommendedAction,
    detail,
  };
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || (msg.includes("does not exist") && msg.includes("relation"));
}

async function probeTable(supabase, table, column = "id") {
  try {
    const { error, count } = await supabase.from(table).select(column, { count: "exact", head: true }).limit(1);
    if (error) {
      if (isMissingTableError(error)) {
        return { reachable: false, count: null, missing: true, detail: truncate(error.message) };
      }
      return { reachable: false, count: null, missing: false, detail: truncate(error.message) };
    }
    return {
      reachable: true,
      count: typeof count === "number" ? count : null,
      missing: false,
      detail:
        typeof count === "number"
          ? `Table reachable (admin-visible rows: ${count.toLocaleString()}).`
          : "Table reachable.",
    };
  } catch (err) {
    return { reachable: false, count: null, missing: false, detail: truncate(err?.message || "Probe failed.") };
  }
}

async function probeStorageBucket(supabase, bucketId) {
  try {
    const { error } = await supabase.storage.from(bucketId).list("", { limit: 1 });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("bucket")) {
        return {
          reachable: false,
          detail: "Bucket not reachable — confirm private kyc-documents bucket exists in Supabase.",
        };
      }
      return {
        reachable: true,
        detail: "Bucket exists; listing may be restricted by policy (expected for private KYC storage).",
      };
    }
    return {
      reachable: true,
      detail: "Private KYC documents bucket responds to admin/storage policy checks.",
    };
  } catch (err) {
    return { reachable: false, detail: truncate(err?.message || "Storage probe failed.") };
  }
}

async function probePwaManifest() {
  try {
    const res = await fetch("/manifest.json", { credentials: "same-origin" });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} fetching /manifest.json.` };
    const json = await res.json();
    const icons = Array.isArray(json?.icons) ? json.icons : [];
    if (icons.length === 0) return { ok: true, partial: true, detail: "Manifest loaded but icons[] is empty." };
    return { ok: true, partial: false, detail: `Manifest OK with ${icons.length} icon(s).` };
  } catch (err) {
    return { ok: false, detail: truncate(err?.message || "Manifest fetch failed.") };
  }
}

function probePayPalMode() {
  const raw = process.env.NEXT_PUBLIC_PAYPAL_MODE;
  const mode = typeof raw === "string" ? raw.trim() : "";
  if (mode === "live") return { mode, live: true, detail: "PayPal mode is live." };
  if (mode === "sandbox") return { mode, live: false, detail: "PayPal mode is sandbox (expected pre-launch)." };
  if (!mode) return { mode: null, live: false, detail: "NEXT_PUBLIC_PAYPAL_MODE not set — defaults to sandbox." };
  return { mode, live: false, detail: `Unexpected PayPal mode value: ${truncate(mode, 40)}` };
}

function probeSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { ok: false, detail: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY." };
  }
  return { ok: true, detail: "Public Supabase env vars are configured." };
}

function statusFromTableProbe(probe, { requireRows = false } = {}) {
  if (probe.missing) return CHECKLIST_STATUS.MISSING;
  if (!probe.reachable) return CHECKLIST_STATUS.PARTIAL;
  if (requireRows && probe.count === 0) return CHECKLIST_STATUS.PARTIAL;
  return CHECKLIST_STATUS.READY;
}

/**
 * @param {{ supabase?: import('@supabase/supabase-js').SupabaseClient }} opts
 */
export async function fetchComplianceChecklist({ supabase } = {}) {
  const client = supabase || defaultClient;

  const [
    kycProfiles,
    kycPolicies,
    kycReviewEvents,
    withdrawalRequests,
    treasuryResolutions,
    treasuryOps,
    fraudLogs,
    securityEvents,
    adminAuditLogs,
    kycStorage,
    pwa,
    withdrawalReconciliation,
  ] = await Promise.all([
    probeTable(client, "kyc_profiles", "user_id"),
    probeTable(client, "kyc_limit_policies", "id"),
    probeTable(client, "kyc_review_events", "id"),
    probeTable(client, "withdrawal_requests", "id"),
    probeTable(client, "treasury_event_resolutions", "id"),
    probeTable(client, "treasury_operational_events", "id"),
    probeTable(client, "fraud_logs", "id"),
    probeTable(client, "security_events", "id"),
    probeTable(client, "admin_audit_logs", "id"),
    probeStorageBucket(client, "kyc-documents"),
    probePwaManifest(),
    fetchWithdrawalReconciliationReport({ supabase: client }).catch(() => null),
  ]);

  const paypal = probePayPalMode();
  const supabaseEnv = probeSupabaseEnv();

  const sections = [
    {
      id: "kyc",
      title: "KYC readiness",
      description: "Identity verification foundation, document storage, review workflow, and limit policies.",
      items: [
        checklistItem({
          id: "kyc_profiles_table",
          label: "KYC profiles table",
          status: statusFromTableProbe(kycProfiles),
          owner: "Compliance",
          notes: "Phase 11A foundation — user KYC status and profile rows.",
          recommendedAction:
            kycProfiles.missing ? "Run phase_11a_kyc_foundation.sql in Supabase." : "Monitor submission volume before launch.",
          detail: kycProfiles.detail,
        }),
        checklistItem({
          id: "kyc_storage_bucket",
          label: "KYC document storage (private bucket)",
          status: kycStorage.reachable ? CHECKLIST_STATUS.READY : CHECKLIST_STATUS.PARTIAL,
          owner: "Security",
          notes: "Private kyc-documents bucket; document paths must never appear in UI.",
          recommendedAction: kycStorage.reachable
            ? "Confirm storage RLS policies from phase_11b_kyc_document_storage.sql."
            : "Create private kyc-documents bucket and apply phase_11b storage policies.",
          detail: kycStorage.detail,
        }),
        checklistItem({
          id: "kyc_review_audit",
          label: "KYC review audit trail",
          status: statusFromTableProbe(kycReviewEvents),
          owner: "Compliance",
          notes: "Append-only kyc_review_events for admin review history.",
          recommendedAction: kycReviewEvents.missing
            ? "Run phase_11c_kyc_review_audit.sql."
            : "Sample review events during admin KYC QA.",
          detail: kycReviewEvents.detail,
        }),
        checklistItem({
          id: "kyc_admin_review_ui",
          label: "Admin KYC review queue",
          status: CHECKLIST_STATUS.READY,
          owner: "Compliance",
          notes: "Admin review at /admin/kyc with status filters and required reject notes.",
          recommendedAction: "Train reviewers on approved / needs_more_info / rejected workflows.",
          detail: "UI shipped (Phase 11C).",
        }),
        checklistItem({
          id: "kyc_user_flow",
          label: "User KYC submission flow",
          status: CHECKLIST_STATUS.READY,
          owner: "Product",
          notes: "User-facing /kyc page with resubmit rules by status.",
          recommendedAction: "Run end-to-end KYC submit → admin approve test cases.",
          detail: "UI shipped (Phase 11A–11C).",
        }),
        checklistItem({
          id: "kyc_limit_policies",
          label: "KYC limit policies",
          status: statusFromTableProbe(kycPolicies),
          owner: "Compliance",
          notes: "Configurable funding/send/withdrawal daily limits and enforcement modes.",
          recommendedAction: kycPolicies.missing
            ? "Run phase_11e_kyc_limit_policy.sql and seed policies."
            : "Review /admin/kyc-limits before public launch.",
          detail: kycPolicies.detail,
        }),
      ],
    },
    {
      id: "withdrawal",
      title: "Withdrawal readiness",
      description: "Compliance context, cumulative daily limits, and server-side creation gate.",
      items: [
        checklistItem({
          id: "withdrawal_admin_queue",
          label: "Admin withdrawal review queue",
          status: CHECKLIST_STATUS.READY,
          owner: "Treasury Ops",
          notes: "KYC compliance panel and caution banners at /admin/withdrawals.",
          recommendedAction: "Rehearse processing/paid actions with compliance caution acknowledgements.",
          detail: "Shipped Phase 11G.",
        }),
        checklistItem({
          id: "withdrawal_client_kyc_gate",
          label: "Client-side withdrawal KYC enforcement",
          status: CHECKLIST_STATUS.READY,
          owner: "Engineering",
          notes: "enforceKycForWithdrawal on /withdraw-wallet before RPC.",
          recommendedAction: "Verify advisory vs soft/hard_block modes in staging.",
          detail: "Shipped Phase 11F.",
        }),
        checklistItem({
          id: "withdrawal_server_kyc_gate",
          label: "Server-side withdrawal KYC gate",
          status: CHECKLIST_STATUS.READY,
          owner: "Engineering",
          notes: "POST /api/withdrawals/check-limit runs enforceServerKycForWithdrawal before create_withdrawal_request.",
          recommendedAction: "Attempt bypass via API client and confirm 403 kyc_withdrawal_blocked.",
          detail: "Shipped Phase 11H (lib/serverKycWithdrawalGuard.js).",
        }),
        checklistItem({
          id: "withdrawal_daily_cumulative",
          label: "Cumulative daily withdrawal limits",
          status: CHECKLIST_STATUS.READY,
          owner: "Compliance",
          notes: "Counts pending + processing + paid withdrawal_requests for local calendar day.",
          recommendedAction: "Validate multi-withdrawal same-day scenarios in staging.",
          detail: "Shipped Phase 11I.",
        }),
        checklistItem({
          id: "withdrawal_requests_table",
          label: "Withdrawal requests table",
          status: statusFromTableProbe(withdrawalRequests),
          owner: "Engineering",
          notes: "Core payout queue data model.",
          recommendedAction: withdrawalRequests.missing
            ? "Apply withdrawal_requests migrations."
            : "Confirm RLS and admin visibility.",
          detail: withdrawalRequests.detail,
        }),
        checklistItem({
          id: "withdrawal_reconciliation_monitor",
          label: "Withdrawal reconciliation monitor",
          status:
            withdrawalReconciliation?.error != null
              ? CHECKLIST_STATUS.PARTIAL
              : (withdrawalReconciliation?.summary?.critical ?? 0) > 0
                ? CHECKLIST_STATUS.PARTIAL
                : CHECKLIST_STATUS.READY,
          owner: "Treasury Ops",
          notes: "Read-only /admin/withdrawal-reconciliation — stuck, inconsistent, and unresolved records.",
          recommendedAction:
            (withdrawalReconciliation?.summary?.critical ?? 0) > 0
              ? `Resolve ${withdrawalReconciliation.summary.critical} critical reconciliation issue(s) before launch.`
              : "Review reconciliation report weekly during soft launch.",
          detail:
            withdrawalReconciliation?.summary != null
              ? `Critical: ${withdrawalReconciliation.summary.critical ?? 0} · Warning: ${withdrawalReconciliation.summary.warning ?? 0} · Total: ${withdrawalReconciliation.summary.total ?? 0}`
              : withdrawalReconciliation?.error || "Phase 13E monitor shipped.",
        }),
      ],
    },
    {
      id: "treasury",
      title: "Treasury controls",
      description: "Operational visibility, event center, and resolution tracking.",
      items: [
        checklistItem({
          id: "treasury_event_center",
          label: "Treasury Event Center",
          status: CHECKLIST_STATUS.READY,
          owner: "Treasury Ops",
          notes: "Read-only ingestion at /admin/treasury-intelligence#treasury-event-center.",
          recommendedAction: "Confirm withdrawal events show KYC metadata and review links.",
          detail: "lib/treasuryEventCenter.js — observe only, no act.",
        }),
        checklistItem({
          id: "treasury_resolutions",
          label: "Treasury event resolutions",
          status: statusFromTableProbe(treasuryResolutions),
          owner: "Treasury Ops",
          notes: "treasury_event_resolutions tracks investigation/resolution state.",
          recommendedAction: treasuryResolutions.missing
            ? "Run phase_5c_treasury_event_resolutions.sql."
            : "Exercise resolution workflow on sample events.",
          detail: treasuryResolutions.detail,
        }),
        checklistItem({
          id: "treasury_operational_events",
          label: "Treasury operational events",
          status: statusFromTableProbe(treasuryOps),
          owner: "Treasury Ops",
          notes: "Snapshot and monitoring events for treasury intelligence.",
          recommendedAction: treasuryOps.missing
            ? "Confirm treasury_operational_events migration is applied."
            : "Review latest snapshots in Treasury Intelligence.",
          detail: treasuryOps.detail,
        }),
        checklistItem({
          id: "treasury_monitoring",
          label: "Treasury monitoring & attention signals",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Treasury Ops",
          notes: "Advisory posture chips on admin home — not automated settlement controls.",
          recommendedAction: "Define human escalation playbook before live-money launch.",
          detail: "lib/treasuryOperations.js advisory monitoring.",
        }),
      ],
    },
    {
      id: "fraud_risk",
      title: "Fraud / risk monitoring",
      description: "Fraud logs, risk dashboards, and KYC usage previews.",
      items: [
        checklistItem({
          id: "fraud_logs_table",
          label: "Fraud logs visibility",
          status: statusFromTableProbe(fraudLogs),
          owner: "Risk",
          notes: "Post-transaction fraud scoring and review queue input.",
          recommendedAction: fraudLogs.missing ? "Install fraud_logs migration." : "Review open fraud items daily pre-launch.",
          detail: fraudLogs.detail,
        }),
        checklistItem({
          id: "fraud_dashboard",
          label: "Fraud admin dashboard",
          status: CHECKLIST_STATUS.READY,
          owner: "Risk",
          notes: "/admin/fraud and /admin/fraud-queue.",
          recommendedAction: "Assign fraud review owners and SLAs.",
          detail: "Existing admin UI.",
        }),
        checklistItem({
          id: "risk_users",
          label: "User risk & KYC advisory usage",
          status: CHECKLIST_STATUS.READY,
          owner: "Risk",
          notes: "/admin/risk-users shows funding/send daily usage preview (Phase 11J).",
          recommendedAction: "Cross-check high-risk users against KYC status.",
          detail: "Advisory previews only — no funding/send blocking.",
        }),
        checklistItem({
          id: "funding_send_preview",
          label: "Funding / send daily limit previews",
          status: CHECKLIST_STATUS.READY,
          owner: "Compliance",
          notes: "Cumulative daily previews on fund-wallet and send-money — advisory only.",
          recommendedAction: "Confirm over-limit copy is visible; submit buttons remain enabled.",
          detail: "Shipped Phase 11J.",
        }),
      ],
    },
    {
      id: "security",
      title: "Security controls",
      description: "Security events, admin audit, and account restrictions.",
      items: [
        checklistItem({
          id: "security_events",
          label: "Security events visibility",
          status: statusFromTableProbe(securityEvents),
          owner: "Security",
          notes: "security_events table feeds /admin/security console.",
          recommendedAction: securityEvents.missing
            ? "Apply security_events migration."
            : "Monitor critical/high events during launch window.",
          detail: securityEvents.detail,
        }),
        checklistItem({
          id: "security_console",
          label: "Security admin console",
          status: CHECKLIST_STATUS.READY,
          owner: "Security",
          notes: "/admin/security for session and signal review.",
          recommendedAction: "Document on-call rotation for security alerts.",
          detail: "Existing admin UI.",
        }),
        checklistItem({
          id: "admin_audit_logs",
          label: "Admin audit logs",
          status: statusFromTableProbe(adminAuditLogs),
          owner: "Security",
          notes: "admin_audit_logs via logAdminAuditEvent (withdrawal compliance, KYC blocks, etc.).",
          recommendedAction: adminAuditLogs.missing
            ? "Run admin_audit_logs.sql migration."
            : "Spot-check withdrawal_compliance_caution_acknowledged entries.",
          detail: adminAuditLogs.detail,
        }),
        checklistItem({
          id: "account_financial_gates",
          label: "Account financial action gates",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Security",
          notes: "assertFinancialActionAllowed / canServerPerformFinancialAction on wallet flows.",
          recommendedAction: "Verify restricted accounts cannot fund/send/withdraw.",
          detail: "lib/accountSecurityStatus.js — manual QA recommended.",
        }),
      ],
    },
    {
      id: "developer_api",
      title: "Developer API controls",
      description: "Developer credential lifecycle and app governance.",
      items: [
        checklistItem({
          id: "dev_credentials_page",
          label: "Developer credentials console",
          status: CHECKLIST_STATUS.READY,
          owner: "Dev Platform",
          notes: "/dev-console/credentials for credential architecture visibility.",
          recommendedAction: "Confirm production API keys are not exposed in client bundles.",
          detail: "Existing Dev Console page.",
        }),
        checklistItem({
          id: "dev_app_governance",
          label: "Developer app governance queue",
          status: CHECKLIST_STATUS.READY,
          owner: "Dev Platform",
          notes: "/dev-console/app-governance and /admin link to developer governance.",
          recommendedAction: "Review pending apps before external developer launch.",
          detail: "Existing governance UI.",
        }),
        checklistItem({
          id: "dev_api_keys",
          label: "API key lifecycle controls",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Dev Platform",
          notes: "Dev Console API keys and capability pages exist; production hardening varies by environment.",
          recommendedAction: "Complete production key rotation and scope review checklist.",
          detail: "Cannot fully verify production key policy from client — manual review required.",
        }),
      ],
    },
    {
      id: "legal",
      title: "Legal / compliance documents",
      description: "Public-facing policies and third-party verification posture.",
      items: [
        checklistItem({
          id: "legal_terms",
          label: "Terms of Service (draft)",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Legal",
          notes: "/legal/terms — foundational draft with operational testing banner.",
          recommendedAction: "Replace with counsel-reviewed terms before public launch.",
          detail: "Phase 11L draft placeholder; final legal review required.",
        }),
        checklistItem({
          id: "legal_privacy",
          label: "Privacy Policy (draft)",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Legal",
          notes: "/legal/privacy — covers KYC docs, transactions, security logs (no document paths exposed).",
          recommendedAction: "Publish production privacy notice after legal review.",
          detail: "Phase 11L draft placeholder; final legal review required.",
        }),
        checklistItem({
          id: "legal_kyc_policy",
          label: "KYC Policy (draft)",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Compliance",
          notes: "/legal/kyc-policy — identity verification, statuses, limits, resubmission.",
          recommendedAction: "Align with final KYC program and jurisdictional requirements.",
          detail: "Phase 11L draft placeholder; final legal review required.",
        }),
        checklistItem({
          id: "legal_aml_policy",
          label: "AML Policy (draft)",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Compliance",
          notes: "/legal/aml-policy — monitoring and reporting readiness placeholder; no licensing claims.",
          recommendedAction: "Formalize AML program and SAR workflow with compliance counsel.",
          detail: "Phase 11L draft placeholder; final legal review required.",
        }),
        checklistItem({
          id: "legal_risk_disclosure",
          label: "Risk Disclosure (draft)",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Legal",
          notes: "/legal/risk-disclosure — wallet, provider, delay, and availability risks.",
          recommendedAction: "Review disclosure language with legal before marketing or launch.",
          detail: "Phase 11L draft placeholder; final legal review required.",
        }),
        checklistItem({
          id: "legal_index",
          label: "Legal document index",
          status: CHECKLIST_STATUS.PARTIAL,
          owner: "Product",
          notes: "/legal — central index linking all draft compliance documents.",
          recommendedAction: "Keep index updated as counsel-approved versions replace drafts.",
          detail: "Phase 11L.",
        }),
        checklistItem({
          id: "kyc_vendor",
          label: "Automated KYC vendor integration",
          status: CHECKLIST_STATUS.MISSING,
          owner: "Compliance",
          notes: "Manual admin review only — no automated identity vendor checks.",
          recommendedAction: "Select and integrate KYC vendor if required for launch jurisdiction.",
          detail: "Intentionally not implemented (Phase 11 scope).",
        }),
      ],
    },
    {
      id: "production",
      title: "Production deployment readiness",
      description: "Infrastructure, payments mode, PWA, and health probes.",
      items: [
        checklistItem({
          id: "supabase_env",
          label: "Supabase client configuration",
          status: supabaseEnv.ok ? CHECKLIST_STATUS.READY : CHECKLIST_STATUS.MISSING,
          owner: "Engineering",
          notes: "NEXT_PUBLIC_SUPABASE_URL and anon key required.",
          recommendedAction: supabaseEnv.ok
            ? "Confirm production project URL and keys in deployment env."
            : "Set Supabase env vars in hosting provider.",
          detail: supabaseEnv.detail,
        }),
        checklistItem({
          id: "paypal_mode",
          label: "PayPal environment mode",
          status: paypal.live ? CHECKLIST_STATUS.READY : CHECKLIST_STATUS.PARTIAL,
          owner: "Treasury Ops",
          notes: "NEXT_PUBLIC_PAYPAL_MODE must be live for production funding.",
          recommendedAction: paypal.live
            ? "Confirm live credentials and webhook endpoints."
            : "Switch to live mode only after treasury/compliance sign-off.",
          detail: paypal.detail,
        }),
        checklistItem({
          id: "pwa_support",
          label: "PWA manifest & icons",
          status: !pwa.ok ? CHECKLIST_STATUS.MISSING : pwa.partial ? CHECKLIST_STATUS.PARTIAL : CHECKLIST_STATUS.READY,
          owner: "Engineering",
          notes: "manifest.json linked from _document; service worker registered in _app.",
          recommendedAction: pwa.ok ? "Test install prompt on mobile devices." : "Fix /manifest.json deployment.",
          detail: pwa.detail,
        }),
        checklistItem({
          id: "admin_health_check",
          label: "Admin health check page",
          status: CHECKLIST_STATUS.READY,
          owner: "Engineering",
          notes: "/admin/health runtime table and env probes.",
          recommendedAction: "Run health check after each production deploy.",
          detail: "Existing admin health page.",
        }),
        checklistItem({
          id: "compliance_checklist",
          label: "Compliance release checklist (this page)",
          status: CHECKLIST_STATUS.READY,
          owner: "Compliance",
          notes: "Read-only release tracking — no enforcement side effects.",
          recommendedAction: "Review all partial/missing items with launch stakeholders.",
          detail: "Phase 11K.",
        }),
        checklistItem({
          id: "production_audit_page",
          label: "Production Environment Audit page",
          status: CHECKLIST_STATUS.READY,
          owner: "Engineering",
          notes: "/admin/production-audit — deployment, Supabase, PayPal, PWA, storage, and security probes.",
          recommendedAction: "Run after each production deploy and before release sign-off.",
          detail: "Phase 11M.",
        }),
      ],
    },
  ];

  let ready = 0;
  let partial = 0;
  let missing = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.status === CHECKLIST_STATUS.READY) ready += 1;
      else if (item.status === CHECKLIST_STATUS.PARTIAL) partial += 1;
      else missing += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ready,
      partial,
      missing,
      total: ready + partial + missing,
    },
    sections,
  };
}

export function complianceStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === CHECKLIST_STATUS.READY) return "Ready";
  if (key === CHECKLIST_STATUS.PARTIAL) return "Partial";
  if (key === CHECKLIST_STATUS.MISSING) return "Missing";
  return "Unknown";
}
