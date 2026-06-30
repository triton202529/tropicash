#!/usr/bin/env node
/**
 * TLP-005 governance & compliance readiness validation (static).
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

function test(id, name, pass, evidence) {
  return { id, name, pass, evidence };
}

const checks = [];

const requiredDocs = [
  "docs/compliance/AML_POLICY.md",
  "docs/compliance/KYC_POLICY.md",
  "docs/compliance/INCIDENT_RESPONSE_PLAYBOOK.md",
  "docs/compliance/OPERATOR_COMPLIANCE_GUIDE.md",
  "docs/compliance/TERMS_OF_SERVICE.md",
  "docs/compliance/PRIVACY_POLICY.md",
  "docs/governance/ACCOUNT_RESTRICTION_PROCEDURES.md",
  "docs/governance/COMPLIANCE_OPERATIONS_MANUAL.md",
];

for (const doc of requiredDocs) {
  const content = read(doc);
  checks.push(
    test(
      `DOC-${doc.split("/").pop()}`,
      `Documentation: ${doc}`,
      !!content && content.length > 500 && !content.includes("TODO placeholder"),
      doc,
    ),
  );
}

checks.push(
  test(
    "AML-001",
    "AML case management library",
    exists("lib/complianceAmlCases.js") && read("lib/complianceAmlCases.js")?.includes("createAmlCase"),
    "lib/complianceAmlCases.js",
  ),
  test(
    "AML-002",
    "Screening provider-agnostic hooks",
    read("lib/complianceScreening.js")?.includes("resolveScreeningProvider") &&
      read("lib/complianceScreening.js")?.includes("manual_override"),
    "lib/complianceScreening.js",
  ),
  test(
    "AML-003",
    "Compliance SQL migration",
    read("supabase/sql/phase_tlp005_compliance_governance.sql")?.includes("compliance_aml_cases"),
    "phase_tlp005_compliance_governance.sql",
  ),
  test(
    "ACC-001",
    "Audited account actions",
    read("lib/complianceAccountActions.js")?.includes("compliance_account_actions") &&
      read("lib/complianceAccountActions.js")?.includes("adminSetAccountSecurityStatus"),
    "lib/complianceAccountActions.js",
  ),
  test(
    "ACC-002",
    "Admin compliance API requires admin",
    read("pages/api/admin/compliance/action.js")?.includes("requireAdminFromBearer"),
    "pages/api/admin/compliance/action.js",
  ),
  test(
    "INC-001",
    "Incident management library",
    exists("lib/complianceIncidents.js"),
    "lib/complianceIncidents.js",
  ),
  test(
    "DASH-001",
    "Compliance dashboard component",
    exists("dashboard/compliance_governance_dashboard.jsx"),
    "dashboard/compliance_governance_dashboard.jsx",
  ),
  test(
    "DASH-002",
    "Admin compliance page",
    exists("pages/admin/compliance-governance.jsx"),
    "pages/admin/compliance-governance.jsx",
  ),
  test(
    "LEG-001",
    "Legal version metadata",
    read("lib/legalDocumentMeta.js")?.includes("LEGAL_DOC_VERSION") &&
      read("lib/legalDocumentMeta.js")?.includes("2026-06-30"),
    "lib/legalDocumentMeta.js",
  ),
  test(
    "LEG-002",
    "Legal layout shows version",
    read("components/legal/LegalDocumentLayout.jsx")?.includes("Version"),
    "LegalDocumentLayout.jsx",
  ),
  test(
    "KYC-001",
    "KYC submission queues screening",
    read("pages/kyc.jsx")?.includes("/api/compliance/queue-screening"),
    "pages/kyc.jsx",
  ),
);

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
const complianceScore = Math.round((passed / Math.max(checks.length, 1)) * 100);

const governanceChecks = checks.filter((c) =>
  ["ACC-001", "ACC-002", "INC-001", "DASH-001", "DASH-002"].includes(c.id),
);
const governanceScore = Math.round(
  (governanceChecks.filter((c) => c.pass).length / Math.max(governanceChecks.length, 1)) * 100,
);

const remainingBlockers = [];
if (!checks.find((c) => c.id === "AML-002")?.pass) remainingBlockers.push("BLK-004: AML screening incomplete");
if (!checks.find((c) => c.id === "LEG-001")?.pass) remainingBlockers.push("BLK-007: Legal versioning missing");
if (complianceScore < 90) remainingBlockers.push("External AML vendor not integrated (deferred by design)");
if (complianceScore < 100) remainingBlockers.push("Counsel formal review of v1.0 policies recommended before GA");

let classification = "NOT READY";
if (complianceScore >= 85 && governanceScore >= 85 && failed <= 2) {
  classification = "READY FOR PRODUCTION OPERATIONS";
}
// Live cutover requires external AML vendor + counsel sign-off + PayPal live — not in TLP-005 scope
const liveCutoverBlockers = [
  "PayPal Live not enabled (TLP-005 scope exclusion)",
  "External AML/sanctions vendor not integrated (manual queue only)",
  "Counsel formal sign-off on v1.0 policies recommended before GA",
];
if (complianceScore >= 95 && governanceScore >= 95 && failed === 0 && liveCutoverBlockers.length === 0) {
  classification = "READY FOR LIVE CUTOVER";
}

const complianceReadiness = {
  phase: "TLP-005",
  generated_at: new Date().toISOString(),
  compliance_readiness_score: complianceScore,
  governance_readiness_score: governanceScore,
  classification,
  recommendation: "Proceed to TLP-006 Production Operations with live-money controls verified in staging.",
  blockers_resolved: {
    "BLK-004": "PARTIAL — manual AML workflow + screening queue; external vendor deferred",
    "BLK-007": "PARTIAL — v1.0 policies published; counsel review before GA",
  },
  remaining_blockers: [...remainingBlockers, ...liveCutoverBlockers],
  live_cutover_blockers: liveCutoverBlockers,
  tests_passed: passed,
  tests_failed: failed,
  tests: checks,
};

const governanceValidation = {
  phase: "TLP-005",
  generated_at: new Date().toISOString(),
  score: governanceScore,
  account_controls: {
    audited_actions: checks.find((c) => c.id === "ACC-001")?.pass ?? false,
    admin_api_gate: checks.find((c) => c.id === "ACC-002")?.pass ?? false,
  },
  incident_framework: checks.find((c) => c.id === "INC-001")?.pass ?? false,
  dashboard: (checks.find((c) => c.id === "DASH-001")?.pass && checks.find((c) => c.id === "DASH-002")?.pass) ?? false,
  operator_docs: requiredDocs.filter((d) => d.startsWith("docs/governance/")).every((d) => exists(d)),
};

const outDir = path.join(ROOT, "data", "compliance");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "compliance_readiness.json"), JSON.stringify(complianceReadiness, null, 2));
fs.writeFileSync(path.join(outDir, "governance_validation.json"), JSON.stringify(governanceValidation, null, 2));

console.log(JSON.stringify({ classification, complianceScore, governanceScore, passed, failed }, null, 2));
