/**
 * Phase 11M: Admin production environment audit (read-only, safe probes).
 *
 * Surfaces deployment, Supabase, PayPal, PWA, storage, security, and legal
 * readiness without exposing secret values or performing write operations.
 */

import { supabase as defaultClient } from "./supabaseClient";

export const AUDIT_STATUS = Object.freeze({
  READY: "ready",
  PARTIAL: "partial",
  MISSING: "missing",
});

export const AUDIT_SECTION_IDS = Object.freeze([
  "environment_variables",
  "supabase_configuration",
  "paypal_configuration",
  "kyc_storage",
  "pwa_readiness",
  "security_compliance",
  "legal_readiness",
  "deployment_readiness",
]);

const LEGAL_PATHS = [
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/kyc-policy",
  "/legal/aml-policy",
  "/legal/risk-disclosure",
];

function truncate(text, max = 180) {
  const s = String(text == null ? "" : text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function auditItem({ id, label, status, notes = "", recommendedAction = "", detail = "" }) {
  return { id, label, status, notes, recommendedAction, detail };
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
        return { reachable: false, missing: true, detail: truncate(error.message) };
      }
      return { reachable: false, missing: false, detail: truncate(error.message) };
    }
    return {
      reachable: true,
      missing: false,
      detail:
        typeof count === "number"
          ? `Table reachable (admin-visible rows: ${count.toLocaleString()}).`
          : "Table reachable.",
    };
  } catch (err) {
    return { reachable: false, missing: false, detail: truncate(err?.message || "Probe failed.") };
  }
}

async function probeStorageBucket(supabase, bucketId) {
  try {
    const { error } = await supabase.storage.from(bucketId).list("", { limit: 1 });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("bucket")) {
        return { reachable: false, detail: "Bucket not reachable — confirm private bucket exists in Supabase." };
      }
      return {
        reachable: true,
        detail: "Bucket exists; listing may be restricted by policy (expected for private KYC storage).",
      };
    }
    return { reachable: true, detail: "Private KYC documents bucket responds to storage policy checks." };
  } catch (err) {
    return { reachable: false, detail: truncate(err?.message || "Storage probe failed.") };
  }
}

function probeEnvPresence(name) {
  const raw = process.env[name];
  const set = typeof raw === "string" && raw.trim().length > 0;
  return {
    set,
    detail: set ? `${name} is configured (value not displayed).` : `${name} is not set.`,
  };
}

function statusFromTableProbe(probe) {
  if (probe.missing) return AUDIT_STATUS.MISSING;
  if (!probe.reachable) return AUDIT_STATUS.PARTIAL;
  return AUDIT_STATUS.READY;
}

async function probeSupabaseClient(supabase) {
  const env = probeEnvPresence("NEXT_PUBLIC_SUPABASE_URL");
  const key = probeEnvPresence("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!env.set || !key.set) {
    return { ok: false, detail: "Missing public Supabase env vars." };
  }
  try {
    const { error } = await supabase.auth.getSession();
    if (error) return { ok: true, partial: true, detail: truncate(error.message) };
    return { ok: true, partial: false, detail: "Supabase client initialised successfully." };
  } catch (err) {
    return { ok: false, detail: truncate(err?.message || "Client probe failed.") };
  }
}

function probePayPalMode() {
  const raw = process.env.NEXT_PUBLIC_PAYPAL_MODE;
  const mode = typeof raw === "string" ? raw.trim() : "";
  if (mode === "live") return { status: AUDIT_STATUS.READY, mode, detail: "PayPal mode is live." };
  if (mode === "sandbox") {
    return {
      status: AUDIT_STATUS.PARTIAL,
      mode,
      detail: "PayPal mode is sandbox (expected pre-launch).",
    };
  }
  if (!mode) {
    return {
      status: AUDIT_STATUS.PARTIAL,
      mode: null,
      detail: "NEXT_PUBLIC_PAYPAL_MODE not set — defaults to sandbox.",
    };
  }
  return {
    status: AUDIT_STATUS.PARTIAL,
    mode,
    detail: `Unexpected PayPal mode value (not displayed in full). Expected live or sandbox.`,
  };
}

async function probePwaManifest() {
  try {
    const res = await fetch("/manifest.json", { credentials: "same-origin" });
    if (!res.ok) return { ok: false, partial: false, detail: `HTTP ${res.status} fetching /manifest.json.` };
    const json = await res.json();
    const icons = Array.isArray(json?.icons) ? json.icons : [];
    if (icons.length === 0) return { ok: true, partial: true, detail: "Manifest loaded but icons[] is empty." };
    return { ok: true, partial: false, detail: `Manifest OK with ${icons.length} icon(s).` };
  } catch (err) {
    return { ok: false, partial: false, detail: truncate(err?.message || "Manifest fetch failed.") };
  }
}

async function probeServiceWorkerFile() {
  try {
    const res = await fetch("/sw.js", { credentials: "same-origin", method: "HEAD" });
    if (res.ok) return { ok: true, detail: "Service worker file /sw.js is deployed." };
    const getRes = await fetch("/sw.js", { credentials: "same-origin" });
    if (getRes.ok) return { ok: true, detail: "Service worker file /sw.js is deployed." };
    return { ok: false, detail: `HTTP ${getRes.status} fetching /sw.js.` };
  } catch (err) {
    return { ok: false, detail: truncate(err?.message || "Service worker probe failed.") };
  }
}

async function probeLegalPage(path) {
  try {
    const res = await fetch(path, { credentials: "same-origin" });
    return { ok: res.ok, detail: res.ok ? `${path} responds (${res.status}).` : `HTTP ${res.status} for ${path}.` };
  } catch (err) {
    return { ok: false, detail: truncate(err?.message || `Failed to fetch ${path}.`) };
  }
}

async function probeWithdrawalGateRoute() {
  try {
    const res = await fetch("/api/withdrawals/check-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 401) {
      return { ok: true, detail: "Withdrawal KYC gate route exists (401 without auth — expected)." };
    }
    if (res.status === 405) {
      return { ok: true, detail: "Withdrawal KYC gate route exists (method enforcement active)." };
    }
    if (res.status === 400 || res.status === 403) {
      return { ok: true, detail: `Withdrawal KYC gate route reachable (HTTP ${res.status}).` };
    }
    return { ok: false, detail: `Unexpected HTTP ${res.status} from /api/withdrawals/check-limit.` };
  } catch (err) {
    return { ok: false, detail: truncate(err?.message || "Route probe failed.") };
  }
}

function summarizeSections(sections) {
  let ready = 0;
  let partial = 0;
  let missing = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.status === AUDIT_STATUS.READY) ready += 1;
      else if (item.status === AUDIT_STATUS.PARTIAL) partial += 1;
      else missing += 1;
    }
  }
  const total = ready + partial + missing;
  let overallStatus = AUDIT_STATUS.READY;
  if (missing > 0) overallStatus = AUDIT_STATUS.MISSING;
  else if (partial > 0) overallStatus = AUDIT_STATUS.PARTIAL;
  return { ready, partial, missing, total, overallStatus };
}

/**
 * @param {{ supabase?: import('@supabase/supabase-js').SupabaseClient }} opts
 */
export async function fetchProductionAudit({ supabase } = {}) {
  const client = supabase || defaultClient;

  const [
    supabaseClientProbe,
    kycProfiles,
    kycPolicies,
    adminAuditLogs,
    fraudLogs,
    securityEvents,
    kycStorage,
    pwaManifest,
    serviceWorker,
    legalResults,
    withdrawalGate,
  ] = await Promise.all([
    probeSupabaseClient(client),
    probeTable(client, "kyc_profiles", "user_id"),
    probeTable(client, "kyc_limit_policies", "id"),
    probeTable(client, "admin_audit_logs", "id"),
    probeTable(client, "fraud_logs", "id"),
    probeTable(client, "security_events", "id"),
    probeStorageBucket(client, "kyc-documents"),
    probePwaManifest(),
    probeServiceWorkerFile(),
    Promise.all(LEGAL_PATHS.map((path) => probeLegalPage(path))),
    probeWithdrawalGateRoute(),
  ]);

  const supabaseUrl = probeEnvPresence("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = probeEnvPresence("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const paypalClientId = probeEnvPresence("NEXT_PUBLIC_PAYPAL_CLIENT_ID");
  const paypalMode = probePayPalMode();

  const legalOkCount = legalResults.filter((r) => r.ok).length;
  const allLegalOk = legalOkCount === LEGAL_PATHS.length;

  const sections = [
    {
      id: "environment_variables",
      title: "Environment variables",
      description: "Public deployment variables required for client-side integrations (presence only — values never shown).",
      items: [
        auditItem({
          id: "env_supabase_url",
          label: "NEXT_PUBLIC_SUPABASE_URL",
          status: supabaseUrl.set ? AUDIT_STATUS.READY : AUDIT_STATUS.MISSING,
          notes: "Supabase project URL for browser client.",
          recommendedAction: supabaseUrl.set
            ? "Confirm production project URL in hosting dashboard."
            : "Set NEXT_PUBLIC_SUPABASE_URL in deployment environment.",
          detail: supabaseUrl.detail,
        }),
        auditItem({
          id: "env_supabase_anon_key",
          label: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          status: supabaseKey.set ? AUDIT_STATUS.READY : AUDIT_STATUS.MISSING,
          notes: "Public anon key — never log or display the value.",
          recommendedAction: supabaseKey.set
            ? "Rotate keys if exposed; confirm RLS policies in Supabase."
            : "Set NEXT_PUBLIC_SUPABASE_ANON_KEY in deployment environment.",
          detail: supabaseKey.detail,
        }),
        auditItem({
          id: "env_paypal_client_id",
          label: "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
          status: paypalClientId.set ? AUDIT_STATUS.READY : AUDIT_STATUS.MISSING,
          notes: "Public PayPal client ID for funding widget.",
          recommendedAction: paypalClientId.set
            ? "Confirm live vs sandbox client ID matches PayPal mode."
            : "Set NEXT_PUBLIC_PAYPAL_CLIENT_ID before enabling funding.",
          detail: paypalClientId.detail,
        }),
        auditItem({
          id: "env_paypal_mode",
          label: "NEXT_PUBLIC_PAYPAL_MODE",
          status: paypalMode.status,
          notes: "Must be live for production funding; sandbox is pre-launch.",
          recommendedAction:
            paypalMode.mode === "live"
              ? "Confirm live REST credentials and webhook endpoints on server."
              : "Switch to live only after treasury/compliance sign-off.",
          detail: paypalMode.detail,
        }),
      ],
    },
    {
      id: "supabase_configuration",
      title: "Supabase configuration",
      description: "Client connectivity and KYC schema reachability.",
      items: [
        auditItem({
          id: "supabase_client_init",
          label: "Supabase client initialisation",
          status: !supabaseClientProbe.ok
            ? AUDIT_STATUS.MISSING
            : supabaseClientProbe.partial
              ? AUDIT_STATUS.PARTIAL
              : AUDIT_STATUS.READY,
          notes: "Lightweight auth.getSession() probe — no writes.",
          recommendedAction: supabaseClientProbe.ok
            ? "Re-run after deploy or key rotation."
            : "Fix Supabase env vars and project availability.",
          detail: supabaseClientProbe.detail,
        }),
        auditItem({
          id: "supabase_kyc_profiles",
          label: "KYC profiles table readable",
          status: statusFromTableProbe(kycProfiles),
          notes: "Phase 11A kyc_profiles table.",
          recommendedAction: kycProfiles.missing
            ? "Run phase_11a_kyc_foundation.sql."
            : "Confirm admin RLS policies allow operational review.",
          detail: kycProfiles.detail,
        }),
        auditItem({
          id: "supabase_kyc_policies",
          label: "KYC limit policies table readable",
          status: statusFromTableProbe(kycPolicies),
          notes: "Withdrawal/funding limit policy rows.",
          recommendedAction: kycPolicies.missing
            ? "Run KYC limit policy migrations."
            : "Seed default policies before launch if empty.",
          detail: kycPolicies.detail,
        }),
      ],
    },
    {
      id: "paypal_configuration",
      title: "PayPal configuration",
      description: "Public PayPal client settings for wallet funding (no server secrets probed here).",
      items: [
        auditItem({
          id: "paypal_client_id_configured",
          label: "PayPal client ID present",
          status: paypalClientId.set ? AUDIT_STATUS.READY : AUDIT_STATUS.MISSING,
          notes: "Browser-visible client ID only.",
          recommendedAction: paypalClientId.set
            ? "Validate funding flow in target PayPal mode."
            : "Configure PayPal client ID in deployment env.",
          detail: paypalClientId.detail,
        }),
        auditItem({
          id: "paypal_mode_configured",
          label: "PayPal mode (live / sandbox)",
          status: paypalMode.status,
          notes: "Server-side PAYPAL_* secrets are not probed or displayed by this page.",
          recommendedAction:
            paypalMode.mode === "live"
              ? "Confirm server PayPal credentials and webhooks separately."
              : "Keep sandbox until treasury approves live cutover.",
          detail: paypalMode.detail,
        }),
      ],
    },
    {
      id: "kyc_storage",
      title: "KYC storage",
      description: "Private document bucket reachability (no document paths or file names exposed).",
      items: [
        auditItem({
          id: "kyc_documents_bucket",
          label: "kyc-documents bucket reachability",
          status: kycStorage.reachable ? AUDIT_STATUS.READY : AUDIT_STATUS.PARTIAL,
          notes: "Private bucket; listing may be restricted — existence check only.",
          recommendedAction: kycStorage.reachable
            ? "Confirm phase_11b storage RLS policies."
            : "Create private kyc-documents bucket in Supabase.",
          detail: kycStorage.detail,
        }),
      ],
    },
    {
      id: "pwa_readiness",
      title: "PWA readiness",
      description: "Progressive web app assets for installability.",
      items: [
        auditItem({
          id: "pwa_manifest",
          label: "manifest.json availability",
          status: !pwaManifest.ok
            ? AUDIT_STATUS.MISSING
            : pwaManifest.partial
              ? AUDIT_STATUS.PARTIAL
              : AUDIT_STATUS.READY,
          notes: "Linked from _document; icons required for install prompt.",
          recommendedAction: pwaManifest.ok ? "Test install on mobile devices." : "Deploy /manifest.json to public/.",
          detail: pwaManifest.detail,
        }),
        auditItem({
          id: "pwa_service_worker",
          label: "Service worker file (sw.js)",
          status: serviceWorker.ok ? AUDIT_STATUS.READY : AUDIT_STATUS.PARTIAL,
          notes: "Registered in _app.js when serviceWorker API is available.",
          recommendedAction: serviceWorker.ok
            ? "Verify offline/cache strategy before marketing PWA install."
            : "Ensure public/sw.js is deployed.",
          detail: serviceWorker.detail,
        }),
      ],
    },
    {
      id: "security_compliance",
      title: "Security / compliance controls",
      description: "Audit, fraud, and server-side withdrawal gate probes (read-only).",
      items: [
        auditItem({
          id: "admin_audit_logs",
          label: "Admin audit logs reachable",
          status: statusFromTableProbe(adminAuditLogs),
          notes: "admin_audit_logs table for compliance trail.",
          recommendedAction: adminAuditLogs.missing
            ? "Run admin audit log migrations."
            : "Sample audit entries during release QA.",
          detail: adminAuditLogs.detail,
        }),
        auditItem({
          id: "fraud_logs",
          label: "Fraud logs table reachable",
          status: statusFromTableProbe(fraudLogs),
          notes: "fraud_logs for suspicious activity monitoring.",
          recommendedAction: fraudLogs.missing ? "Confirm fraud schema migrations applied." : "Monitor fraud queue before launch.",
          detail: fraudLogs.detail,
        }),
        auditItem({
          id: "security_events",
          label: "Security events table reachable",
          status: statusFromTableProbe(securityEvents),
          notes: "security_events for account security signals.",
          recommendedAction: securityEvents.missing
            ? "Confirm security_events schema exists."
            : "Review security event volume during staging.",
          detail: securityEvents.detail,
        }),
        auditItem({
          id: "withdrawal_server_gate",
          label: "Withdrawal server KYC gate route",
          status: withdrawalGate.ok ? AUDIT_STATUS.READY : AUDIT_STATUS.PARTIAL,
          notes: "POST /api/withdrawals/check-limit — existence probe only; no withdrawal created.",
          recommendedAction: withdrawalGate.ok
            ? "Run end-to-end withdrawal limit tests in staging."
            : "Confirm API route is deployed and reachable.",
          detail: withdrawalGate.detail,
        }),
      ],
    },
    {
      id: "legal_readiness",
      title: "Legal readiness",
      description: "Draft legal/compliance pages (Phase 11L) — pending formal legal review.",
      items: [
        auditItem({
          id: "legal_pages",
          label: "Legal document pages reachable",
          status: allLegalOk
            ? AUDIT_STATUS.PARTIAL
            : legalOkCount > 0
              ? AUDIT_STATUS.PARTIAL
              : AUDIT_STATUS.MISSING,
          notes: `${legalOkCount}/${LEGAL_PATHS.length} pages respond. All remain draft placeholders.`,
          recommendedAction: "Complete formal legal review before public launch marketing.",
          detail: legalResults.map((r) => r.detail).join(" "),
        }),
      ],
    },
    {
      id: "deployment_readiness",
      title: "Deployment readiness",
      description: "Release tooling and admin operational pages.",
      items: [
        auditItem({
          id: "admin_health_page",
          label: "Admin health check page",
          status: AUDIT_STATUS.READY,
          notes: "/admin/health — runtime table and env probes.",
          recommendedAction: "Run after each production deploy.",
          detail: "Existing admin health page.",
        }),
        auditItem({
          id: "compliance_checklist_page",
          label: "Compliance release checklist",
          status: AUDIT_STATUS.READY,
          notes: "/admin/compliance-checklist — read-only release tracking.",
          recommendedAction: "Review partial/missing items with launch stakeholders.",
          detail: "Phase 11K.",
        }),
        auditItem({
          id: "production_audit_page",
          label: "Production Environment Audit (this page)",
          status: AUDIT_STATUS.READY,
          notes: "/admin/production-audit — Phase 11M.",
          recommendedAction: "Re-run before release sign-off.",
          detail: "Read-only audit; no side effects.",
        }),
        auditItem({
          id: "node_env",
          label: "NODE_ENV",
          status:
            process.env.NODE_ENV === "production"
              ? AUDIT_STATUS.READY
              : process.env.NODE_ENV === "development"
                ? AUDIT_STATUS.PARTIAL
                : AUDIT_STATUS.PARTIAL,
          notes: "Build/runtime environment indicator (not a secret).",
          recommendedAction:
            process.env.NODE_ENV === "production"
              ? "Confirm production build deployed to hosting."
              : "Expect partial status in local development.",
          detail: `NODE_ENV=${process.env.NODE_ENV || "undefined"}.`,
        }),
      ],
    },
  ];

  const summary = summarizeSections(sections);

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: summary.overallStatus,
    summary: {
      ready: summary.ready,
      partial: summary.partial,
      missing: summary.missing,
      total: summary.total,
    },
    sections,
  };
}

export function auditStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === AUDIT_STATUS.READY) return "Ready";
  if (key === AUDIT_STATUS.PARTIAL) return "Partial";
  if (key === AUDIT_STATUS.MISSING) return "Missing";
  return "Unknown";
}

export function getProductionAuditSectionIds() {
  return [...AUDIT_SECTION_IDS];
}
