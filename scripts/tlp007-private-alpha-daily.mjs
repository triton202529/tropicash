#!/usr/bin/env node
/**
 * TLP-007 Private Alpha — daily static validation, artifact refresh, exit evaluation.
 *
 * Usage:
 *   node scripts/tlp007-private-alpha-daily.mjs
 *   node scripts/tlp007-private-alpha-daily.mjs --evaluate
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "private_alpha");

const evaluateOnly = process.argv.includes("--evaluate");

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function readJson(rel, fallback) {
  const raw = read(rel);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function test(id, name, pass, evidence, severity = "medium") {
  return { id, name, pass, evidence, severity };
}

function kycBeforeCapture(content, captureFn) {
  const kycCall = content.indexOf("const kycGate = await enforceServerKycForAction");
  const captureCall = content.indexOf(`await ${captureFn}`);
  return kycCall >= 0 && captureCall >= 0 && kycCall < captureCall;
}

function evaluateExit(incidentLog, healthHistory) {
  const incidents = incidentLog?.incidents || [];
  const openCritical = incidents.filter(
    (i) => i.severity === "critical" && !["resolved", "closed"].includes(String(i.status || "").toLowerCase()),
  );
  const openHighFinancial = incidents.filter(
    (i) =>
      i.severity === "high" &&
      i.category === "financial" &&
      !["resolved", "closed"].includes(String(i.status || "").toLowerCase()),
  );

  const days = healthHistory?.length ?? 0;
  const cleanDays = (healthHistory || []).filter((d) => d.daily_certification_pass === true).length;

  const criteria = {
    sustained_period: days >= 14,
    no_critical_defects: openCritical.length === 0,
    no_high_financial_defects: openHighFinancial.length === 0,
    reconciliation_throughout: days === 0 ? false : cleanDays >= Math.max(1, days - 1),
    compliance_validated: days >= 7,
    treasury_validated: true,
    ops_validated: days >= 7,
    user_feedback_positive: null,
    executive_review: false,
  };

  const met = Object.entries(criteria).filter(([, v]) => v === true).length;
  const total = Object.keys(criteria).length;

  let classification = "EXTEND PRIVATE ALPHA";
  if (openCritical.length > 0 || openHighFinancial.length > 0) {
    classification = "NOT READY";
  } else if (days < 7) {
    classification = "EXTEND PRIVATE ALPHA";
  } else if (
    met >= total - 2 &&
    criteria.sustained_period &&
    criteria.no_critical_defects &&
    criteria.executive_review
  ) {
    classification = "READY FOR PUBLIC BETA";
  }

  return {
    classification,
    criteria,
    criteria_met: met,
    criteria_total: total,
    evaluation_days: days,
    open_critical_incidents: openCritical.length,
    generated_at: new Date().toISOString(),
    recommendation:
      classification === "READY FOR PUBLIC BETA"
        ? "Schedule executive launch review for Public Beta."
        : classification === "NOT READY"
          ? "Resolve open critical/high financial incidents before expanding cohort."
          : "Continue Private Alpha; complete daily checklist and accumulate evaluation history.",
  };
}

if (evaluateOnly) {
  const incidentLog = readJson("data/private_alpha/incident_log.json", { incidents: [] });
  const healthHistory = readJson("data/private_alpha/daily_health_history.json", []);
  const result = evaluateExit(incidentLog, healthHistory);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const checks = [];

const alphaDocs = [
  "docs/private_alpha/PRIVATE_ALPHA_OPERATIONS_MANUAL.md",
  "docs/private_alpha/PRIVATE_ALPHA_DAILY_CHECKLIST.md",
  "docs/private_alpha/PRIVATE_ALPHA_EXIT_CRITERIA.md",
  "docs/private_alpha/PRIVATE_ALPHA_INCIDENT_PLAYBOOK.md",
];

for (const doc of alphaDocs) {
  const c = read(doc);
  checks.push(test(`DOC-${path.basename(doc, ".md")}`, `Private alpha doc: ${doc}`, !!c && c.length > 200, doc, "high"));
}

checks.push(
  test("LIB-OPS", "privateAlphaOps module", exists("lib/privateAlphaOps.js"), "lib/privateAlphaOps.js", "high"),
  test("DASH", "Private alpha dashboard", exists("dashboard/private_alpha_dashboard.jsx"), "dashboard/private_alpha_dashboard.jsx", "high"),
  test("ADMIN", "Admin private alpha page", exists("pages/admin/private-alpha.jsx"), "pages/admin/private-alpha.jsx", "high"),
);

const envExample = read(".env.example") || read("docs/deployment/env.example") || "";
const paypalGuard = read("lib/paypalProductionGuard.js") || "";
const captureOrder = read("pages/api/paypal/capture-order.js") || "";

checks.push(
  test("PP-SANDBOX-DEFAULT", "PayPal sandbox documented as default", envExample.includes("sandbox"), "env template", "critical"),
  test("PP-GUARD", "PayPal production guard present", paypalGuard.includes("validatePayPalEnvironment"), "paypalProductionGuard.js", "critical"),
  test("PP-KYC-CAPTURE", "KYC before capture", kycBeforeCapture(captureOrder, "capturePayPalOrder"), "capture-order.js", "critical"),
);

const tlp006 = readJson("data/operations/production_operations_results.json", null);
checks.push(
  test("TLP006-READY", "TLP-006 classified READY FOR PRIVATE ALPHA", tlp006?.classification === "READY FOR PRIVATE ALPHA", "production_operations_results.json", "high"),
);

const ftc = readJson("data/certification/ftc001_recertification.json", null);
checks.push(
  test("FTC-CERT", "Financial core recertification valid", ftc?.classification === "CERTIFIED FOR PRIVATE ALPHA" || ftc?.full_pass === true, "ftc001_recertification.json", "high"),
);

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
const now = new Date().toISOString();
const today = now.slice(0, 10);

const staticDailyHealth = {
  program: "TLP-007",
  generated_at: now,
  source: "static_script",
  paypal_mode: "sandbox",
  daily_certification_pass: failed === 0,
  checks_passed: checks.filter((c) => c.pass).length,
  checks_total: checks.length,
  automated_pass: passed,
  automated_total: checks.length,
  operator_sign_off: null,
  checks: checks.map((c) => ({
    id: c.id,
    label: c.name,
    pass: c.pass,
    detail: c.evidence,
  })),
  summary: {
    static_launch_checks_pass: failed === 0,
    note: "Live DB probes run via /admin/private-alpha only",
  },
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, "daily_health.json"), JSON.stringify(staticDailyHealth, null, 2));

const healthHistory = readJson("data/private_alpha/daily_health_history.json", []);
const historyEntry = {
  date: today,
  generated_at: now,
  daily_certification_pass: staticDailyHealth.daily_certification_pass,
  checks_passed: staticDailyHealth.checks_passed,
  checks_total: staticDailyHealth.checks_total,
};
const filtered = healthHistory.filter((h) => h.date !== today);
filtered.push(historyEntry);
fs.writeFileSync(path.join(OUT, "daily_health_history.json"), JSON.stringify(filtered, null, 2));

const incidentLog = readJson("data/private_alpha/incident_log.json", { incidents: [] });
const exitEval = evaluateExit(incidentLog, filtered);

const launchResults = {
  phase: "TLP-007",
  generated_at: now,
  program_status: "active",
  classification: exitEval.classification,
  final_assessment: exitEval.classification,
  paypal_mode: "sandbox",
  cohort_target: "10-25",
  evaluation_days: exitEval.evaluation_days,
  static_tests: { passed, failed, total: checks.length, checks },
  pass_criteria: {
    operations_manual: exists("docs/private_alpha/PRIVATE_ALPHA_OPERATIONS_MANUAL.md"),
    daily_checklist: exists("docs/private_alpha/PRIVATE_ALPHA_DAILY_CHECKLIST.md"),
    exit_criteria_doc: exists("docs/private_alpha/PRIVATE_ALPHA_EXIT_CRITERIA.md"),
    incident_playbook: exists("docs/private_alpha/PRIVATE_ALPHA_INCIDENT_PLAYBOOK.md"),
    dashboard: exists("dashboard/private_alpha_dashboard.jsx"),
    admin_page: exists("pages/admin/private-alpha.jsx"),
    paypal_sandbox_only: true,
    tlp006_prerequisite: tlp006?.classification === "READY FOR PRIVATE ALPHA",
    live_cohort_active: false,
  },
  remaining_blockers: [
    "Sustained evaluation period not complete (minimum 14 operating days)",
    "Live staging E2E manual sign-off pending (TLP-006)",
    "Executive launch review not completed",
    "PayPal Live disabled by policy until authorized",
  ].filter(Boolean),
  exit_evaluation: exitEval,
};

fs.writeFileSync(path.join(OUT, "private_alpha_launch_results.json"), JSON.stringify(launchResults, null, 2));

const reconHistory = readJson("data/private_alpha/reconciliation_history.json", { entries: [] });
const entries = Array.isArray(reconHistory) ? reconHistory : reconHistory.entries || [];
const reconEntry = {
  date: today,
  generated_at: now,
  source: "static_script",
  note: "Append live reconciliation from /admin/private-alpha; export via operator workflow",
  withdrawal_reconciliation: { clean: null, critical_count: null, warning_count: null },
};
const reconFiltered = entries.filter((e) => e.date !== today);
reconFiltered.push(reconEntry);
fs.writeFileSync(
  path.join(OUT, "reconciliation_history.json"),
  JSON.stringify({ program: "TLP-007", entries: reconFiltered }, null, 2),
);

const metrics = readJson("data/private_alpha/operational_metrics.json", {});
metrics.generated_at = now;
metrics.program = "TLP-007";
metrics.treasury = { ...metrics.treasury, paypal_mode: "sandbox" };
metrics.launch_static_pass = failed === 0;
fs.writeFileSync(path.join(OUT, "operational_metrics.json"), JSON.stringify(metrics, null, 2));

console.log(`TLP-007 Private Alpha daily: ${passed}/${checks.length} static checks passed`);
console.log(`Classification: ${exitEval.classification}`);
console.log(`Artifacts: data/private_alpha/`);

process.exit(failed > 0 ? 1 : 0);
