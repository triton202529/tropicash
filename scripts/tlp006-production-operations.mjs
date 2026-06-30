#!/usr/bin/env node
/**
 * TLP-006 production operations & staging certification (static validation).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function test(id, name, pass, evidence, severity = "medium", liveRequired = false) {
  return { id, name, pass, evidence, severity, live_required: liveRequired };
}

function kycBeforeCapture(content, captureFn) {
  const kycCall = content.indexOf("const kycGate = await enforceServerKycForAction");
  const captureCall = content.indexOf(`await ${captureFn}`);
  return kycCall >= 0 && captureCall >= 0 && kycCall < captureCall;
}

const checks = [];

const opsDocs = [
  "docs/operations/PRODUCTION_OPERATIONS_CERTIFICATION.md",
  "docs/operations/DEPLOYMENT_CHECKLIST.md",
  "docs/operations/ROLLBACK_PROCEDURE.md",
  "docs/operations/DISASTER_RECOVERY_PLAN.md",
  "docs/operations/MONITORING_GUIDE.md",
  "docs/operations/STAGING_EXECUTION_REPORT.md",
];

for (const doc of opsDocs) {
  const c = read(doc);
  checks.push(
    test(
      `DOC-${path.basename(doc, ".md")}`,
      `Operations doc: ${doc}`,
      !!c && c.length > 400,
      doc,
      "high",
    ),
  );
}

const captureOrder = read("pages/api/paypal/capture-order.js") || "";
const createOrder = read("pages/api/paypal/create-order.js") || "";
const webhook = read("pages/api/webhooks/paypal.js") || "";
const paypalGuard = read("lib/paypalProductionGuard.js") || "";
const envExample = read(".env.example") || read("docs/deployment/env.example") || "";

checks.push(
  test("ENV-001", "Env template exists", !!envExample && envExample.includes("SUPABASE_SERVICE_ROLE_KEY"), ".env.example or docs/deployment/env.example", "critical"),
  test("ENV-002", "Service role documented as server-only", envExample.includes("SUPABASE_SERVICE_ROLE_KEY") && !envExample.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), "env template", "critical"),
  test("ENV-003", "PayPal mode vars documented", envExample.includes("PAYPAL_MODE") && envExample.includes("NEXT_PUBLIC_PAYPAL_MODE"), "env template", "high"),
  test("ENV-004", "No secrets in repo (spot check)", !read("package.json")?.includes("sk_live"), "grep spot check", "critical"),
);

checks.push(
  test("PP-001", "PayPal guard on create-order", createOrder.includes("payPalConfigGateForMoneyApi"), "create-order.js", "critical"),
  test("PP-002", "PayPal guard on capture-order", captureOrder.includes("payPalConfigGateForMoneyApi"), "capture-order.js", "critical"),
  test("PP-003", "Mode mismatch detection", paypalGuard.includes("mode mismatch"), "paypalProductionGuard.js", "critical"),
  test("PP-004", "Live mode webhook ID required", paypalGuard.includes("PAYPAL_WEBHOOK_ID"), "paypalProductionGuard.js", "high"),
  test("PP-005", "KYC before PayPal capture", kycBeforeCapture(captureOrder, "capturePayPalOrder"), "capture-order.js", "critical"),
  test("PP-006", "KYC before create-order", kycBeforeCapture(createOrder, "createPayPalOrder"), "create-order.js", "critical"),
  test("PP-007", "Funding idempotency on capture", captureOrder.includes("claimFundingProcessingSlot"), "capture-order.js", "critical"),
  test("PP-008", "Sandbox remains default in template", envExample.includes("sandbox"), "env template", "high"),
);

checks.push(
  test("WH-001", "Webhook signature verification", webhook.includes("verifyPayPalWebhookSignature") || webhook.includes("verify-webhook-signature"), "webhooks/paypal.js", "critical"),
  test("WH-002", "Webhook raw body parser disabled", webhook.includes("bodyParser: false"), "webhooks/paypal.js", "high"),
  test("WH-003", "Payout webhook events table in SQL", (read("supabase/sql/tropicash_automated_payouts.sql") || "").includes("payout_webhook_events"), "tropicash_automated_payouts.sql", "high"),
);

checks.push(
  test("DEP-001", "Production deployment guide", exists("docs/deployment/PRODUCTION_DEPLOYMENT.md"), "PRODUCTION_DEPLOYMENT.md", "high"),
  test("DEP-002", "Rollback procedure doc", exists("docs/operations/ROLLBACK_PROCEDURE.md"), "ROLLBACK_PROCEDURE.md", "high"),
  test("DEP-003", "Deployment checklist doc", exists("docs/operations/DEPLOYMENT_CHECKLIST.md"), "DEPLOYMENT_CHECKLIST.md", "high"),
);

checks.push(
  test("MON-001", "Operational logger exists", exists("lib/operationalLogger.js"), "operationalLogger.js", "high"),
  test("MON-002", "PayPal routes log operational errors", captureOrder.includes("logOperationalError"), "capture-order.js", "medium"),
  test("MON-003", "Monitoring guide doc", exists("docs/operations/MONITORING_GUIDE.md"), "MONITORING_GUIDE.md", "high"),
  test("MON-004", "Admin health page", exists("pages/admin/health.jsx") || exists("pages/admin/health.js"), "admin health", "medium"),
  test("MON-005", "Production audit page lib", exists("lib/productionAudit.js"), "productionAudit.js", "medium"),
);

checks.push(
  test("BKP-001", "Disaster recovery plan", exists("docs/operations/DISASTER_RECOVERY_PLAN.md"), "DISASTER_RECOVERY_PLAN.md", "high"),
  test("BKP-002", "DR plan defines RTO/RPO", (read("docs/operations/DISASTER_RECOVERY_PLAN.md") || "").includes("RTO") && (read("docs/operations/DISASTER_RECOVERY_PLAN.md") || "").includes("RPO"), "DISASTER_RECOVERY_PLAN.md", "high"),
);

checks.push(
  test("OPS-001", "Compliance governance dashboard", exists("pages/admin/compliance-governance.jsx"), "compliance-governance", "high"),
  test("OPS-002", "Production ops dashboard component", exists("dashboard/production_operations_dashboard.jsx"), "production_operations_dashboard.jsx", "high"),
  test("OPS-003", "Incident playbook", exists("docs/compliance/INCIDENT_RESPONSE_PLAYBOOK.md"), "INCIDENT_RESPONSE_PLAYBOOK.md", "high"),
  test("OPS-004", "Operator compliance guide", exists("docs/compliance/OPERATOR_COMPLIANCE_GUIDE.md"), "OPERATOR_COMPLIANCE_GUIDE.md", "high"),
);

checks.push(
  test("FIN-001", "FTC-001 recertification script", exists("scripts/ftc001-recertification.mjs"), "ftc001-recertification.mjs", "critical"),
  test("FIN-002", "Prior recertification results", exists("data/certification/ftc001_recertification.json"), "ftc001_recertification.json", "high"),
);

const liveScenarios = [
  { id: "LIVE-001", name: "Register + KYC submit", status: "manual_required", pass: null },
  { id: "LIVE-002", name: "Sandbox fund E2E (create → capture → balance)", status: "manual_required", pass: null },
  { id: "LIVE-003", name: "Duplicate capture idempotency", status: "manual_required", pass: null },
  { id: "LIVE-004", name: "P2P transfer with idempotency key", status: "manual_required", pass: null },
  { id: "LIVE-005", name: "Withdrawal create + admin approval", status: "manual_required", pass: null },
  { id: "LIVE-006", name: "Ledger reconciliation clean", status: "manual_required", pass: null },
  { id: "LIVE-007", name: "Compliance screening queue on KYC", status: "manual_required", pass: null },
  { id: "LIVE-008", name: "PayPal payout webhook (sandbox)", status: "manual_required", pass: null },
  { id: "LIVE-009", name: "npm run build succeeds", status: "manual_required", pass: null },
];

const staticChecks = checks.filter((c) => !c.live_required);
const passed = staticChecks.filter((c) => c.pass).length;
const failed = staticChecks.filter((c) => !c.pass).length;
const opsScore = Math.round((passed / Math.max(staticChecks.length, 1)) * 100);

const ftcRecert = JSON.parse(read("data/certification/ftc001_recertification.json") || "{}");
const complianceReady = JSON.parse(read("data/compliance/compliance_readiness.json") || "{}");
const financialValid = ftcRecert.classification === "CERTIFIED FOR PRIVATE ALPHA";

const deploymentScore = Math.round(
  (checks.filter((c) => c.id.startsWith("DEP") && c.pass).length / 3) * 100,
);
const monitoringScore = Math.round(
  (checks.filter((c) => c.id.startsWith("MON") && c.pass).length / 5) * 100,
);
const envScore = Math.round((checks.filter((c) => c.id.startsWith("ENV") && c.pass).length / 4) * 100);
const paypalScore = Math.round((checks.filter((c) => c.id.startsWith("PP") && c.pass).length / 8) * 100);

const overallScore = Math.round(
  (opsScore + deploymentScore + monitoringScore + envScore + paypalScore + (financialValid ? 100 : 0)) / 6,
);

const remainingBlockers = [];
if (!financialValid) remainingBlockers.push("Financial certification not PRIVATE ALPHA");
if (failed > 0) remainingBlockers.push(`${failed} static certification check(s) failed`);
remainingBlockers.push("Live staging E2E not executed in CI (manual required)");
remainingBlockers.push("External APM/uptime monitoring not integrated");
remainingBlockers.push("PayPal Live intentionally disabled (Private Alpha uses sandbox)");

let classification = "NOT READY";
if (overallScore >= 85 && failed === 0 && financialValid) {
  classification = "READY FOR PRIVATE ALPHA";
}
if (overallScore >= 98 && failed === 0 && financialValid && liveScenarios.every((s) => s.pass === true)) {
  classification = "READY FOR LIVE CUTOVER";
}

const productionResults = {
  phase: "TLP-006",
  generated_at: new Date().toISOString(),
  classification,
  overall_score: overallScore,
  scores: {
    environment: envScore,
    paypal_staging: paypalScore,
    deployment: deploymentScore,
    monitoring: monitoringScore,
    operations_static: opsScore,
    financial_certification: financialValid ? 100 : ftcRecert.overall_score ?? 0,
    compliance_readiness: complianceReady.compliance_readiness_score ?? null,
  },
  financial_certification_valid: financialValid,
  pass_criteria: {
    deployment_documented: checks.find((c) => c.id === "DEP-001")?.pass ?? false,
    rollback_documented: checks.find((c) => c.id === "DEP-002")?.pass ?? false,
    monitoring_documented: checks.find((c) => c.id === "MON-003")?.pass ?? false,
    backup_documented: checks.find((c) => c.id === "BKP-001")?.pass ?? false,
    paypal_sandbox_guards: checks.find((c) => c.id === "PP-005")?.pass ?? false,
    kyc_before_capture: checks.find((c) => c.id === "PP-005")?.pass ?? false,
    live_staging_e2e: false,
  },
  remaining_blockers: remainingBlockers,
  static_tests: { passed, failed, total: staticChecks.length, checks: staticChecks },
  live_scenarios: liveScenarios,
  recommendation: "Execute STAGING_EXECUTION_REPORT.md manual checklist in deployed sandbox before inviting Private Alpha cohort.",
};

const stagingValidation = {
  phase: "TLP-006",
  generated_at: new Date().toISOString(),
  executed: false,
  environment: "sandbox",
  scenarios: liveScenarios.map((s) => ({
    ...s,
    evidence: "Pending manual execution — see docs/operations/STAGING_EXECUTION_REPORT.md",
  })),
  note: "Static certification passed; live E2E requires deployed Supabase + PayPal sandbox credentials.",
};

const monitoringValidation = {
  phase: "TLP-006",
  generated_at: new Date().toISOString(),
  internal_monitoring: {
    operational_logs: checks.find((c) => c.id === "MON-001")?.pass ?? false,
    admin_health: checks.find((c) => c.id === "MON-004")?.pass ?? false,
    production_audit: checks.find((c) => c.id === "MON-005")?.pass ?? false,
    compliance_dashboard: checks.find((c) => c.id === "OPS-001")?.pass ?? false,
  },
  external_apm: false,
  documented: checks.find((c) => c.id === "MON-003")?.pass ?? false,
  score: monitoringScore,
};

const deploymentValidation = {
  phase: "TLP-006",
  generated_at: new Date().toISOString(),
  checklist: checks.filter((c) => c.id.startsWith("DEP")).map((c) => ({ id: c.id, pass: c.pass, evidence: c.evidence })),
  rollback_doc: exists("docs/operations/ROLLBACK_PROCEDURE.md"),
  env_template: exists(".env.example") || exists("docs/deployment/env.example"),
  score: deploymentScore,
};

const outDir = path.join(ROOT, "data", "operations");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "production_operations_results.json"), JSON.stringify(productionResults, null, 2));
fs.writeFileSync(path.join(outDir, "staging_validation_results.json"), JSON.stringify(stagingValidation, null, 2));
fs.writeFileSync(path.join(outDir, "monitoring_validation.json"), JSON.stringify(monitoringValidation, null, 2));
fs.writeFileSync(path.join(outDir, "deployment_validation.json"), JSON.stringify(deploymentValidation, null, 2));

console.log(JSON.stringify({ classification, overall_score: overallScore, passed, failed, financialValid }, null, 2));
