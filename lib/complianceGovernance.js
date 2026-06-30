/**
 * Compliance governance dashboard — read-only aggregate stats (TLP-005).
 */

import { supabase as defaultClient } from "./supabaseClient";
import { SCREENING_TABLE } from "./complianceScreening";
import { AML_CASES_TABLE } from "./complianceAmlCases";
import { INCIDENTS_TABLE } from "./complianceIncidents";

const ACTIVE_AML_STATUSES = ["open", "under_review", "escalated", "sar_draft"];
const OPEN_INCIDENT_STATUSES = ["open", "investigating", "mitigated"];

async function countTable(client, table, filters = []) {
  try {
    let q = client.from(table).select("id", { count: "exact", head: true });
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val);
      if (f.op === "in") q = q.in(f.col, f.val);
    }
    const { count, error } = await q;
    if (error) return { count: null, error: error.message };
    return { count: count ?? 0 };
  } catch (e) {
    return { count: null, error: e?.message || String(e) };
  }
}

/**
 * Fetch compliance dashboard snapshot (read-only).
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function fetchComplianceGovernanceSnapshot(opts = {}) {
  const client = opts.supabaseClient || defaultClient;

  const [
    kycPending,
    screeningPending,
    amlActive,
    restrictedAccounts,
    frozenAccounts,
    highRiskUsers,
    openIncidents,
    amlEscalated,
  ] = await Promise.all([
    countTable(client, "kyc_profiles", [{ op: "in", col: "status", val: ["submitted", "under_review", "needs_more_info"] }]),
    countTable(client, SCREENING_TABLE, [{ op: "eq", col: "status", val: "pending_review" }]),
    countTable(client, AML_CASES_TABLE, [{ op: "in", col: "status", val: ACTIVE_AML_STATUSES }]),
    countTable(client, "account_security_status", [{ op: "eq", col: "status", val: "restricted" }]),
    countTable(client, "account_security_status", [{ op: "eq", col: "status", val: "frozen" }]),
    countTable(client, "account_security_status", [{ op: "in", col: "risk_level", val: ["high", "critical"] }]),
    countTable(client, INCIDENTS_TABLE, [{ op: "in", col: "status", val: OPEN_INCIDENT_STATUSES }]),
    countTable(client, AML_CASES_TABLE, [{ op: "eq", col: "status", val: "escalated" }]),
  ]);

  return {
    generated_at: new Date().toISOString(),
    kyc_queue_pending: kycPending.count,
    aml_screening_pending: screeningPending.count,
    aml_cases_active: amlActive.count,
    aml_cases_escalated: amlEscalated.count,
    restricted_accounts: restrictedAccounts.count,
    frozen_accounts: frozenAccounts.count,
    high_risk_users: highRiskUsers.count,
    open_incidents: openIncidents.count,
    table_errors: [
      screeningPending.error,
      amlActive.error,
      restrictedAccounts.error,
      frozenAccounts.error,
      openIncidents.error,
    ].filter(Boolean),
  };
}
