/**
 * Provider-agnostic sanctions / PEP screening (TLP-005).
 * No vendor hardcoding — provider from env or explicit manual review.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { logAdminAuditEvent } from "./adminAudit";
import { sanitizeOperationalMetadata } from "./operationalLogger";

export const SCREENING_TABLE = "compliance_screening_results";
export const SCREENING_TYPES = Object.freeze(["sanctions", "pep"]);
export const SCREENING_STATUSES = Object.freeze([
  "pending_review",
  "approved",
  "rejected",
  "manual_override",
]);

const TYPE_SET = new Set(SCREENING_TYPES);
const STATUS_SET = new Set(SCREENING_STATUSES);

const SELECT_COLS =
  "id, user_id, screening_type, provider, status, subject_name, subject_data, match_details, provider_reference, screened_at, reviewed_at, reviewed_by, override_reason, notes, created_at, updated_at";

function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes("compliance_screening_results");
}

/**
 * Resolve screening provider from environment (no vendor lock-in).
 * @returns {string}
 */
export function resolveScreeningProvider() {
  const configured =
    process.env.TROPICASH_SANCTIONS_PROVIDER?.trim() ||
    process.env.TROPICASH_COMPLIANCE_SCREENING_PROVIDER?.trim() ||
    "";
  return configured || "manual";
}

/**
 * Queue a screening for admin review (internal hook — no external API call in TLP-005).
 * @param {{
 *   userId: string;
 *   screeningType: 'sanctions' | 'pep';
 *   subjectName?: string | null;
 *   subjectData?: Record<string, unknown>;
 *   matchDetails?: Record<string, unknown>;
 *   provider?: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function queueComplianceScreening({
  userId,
  screeningType,
  subjectName = null,
  subjectData = {},
  matchDetails = {},
  provider,
  supabaseClient,
} = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const type = String(screeningType || "").toLowerCase();
  if (!uid || !TYPE_SET.has(type)) {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const row = {
    user_id: uid,
    screening_type: type,
    provider: provider || resolveScreeningProvider(),
    status: "pending_review",
    subject_name: subjectName?.trim() || null,
    subject_data: sanitizeOperationalMetadata(subjectData),
    match_details: sanitizeOperationalMetadata(matchDetails),
    screened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from(SCREENING_TABLE).insert(row).select(SELECT_COLS).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }
  return { ok: true, screening: data };
}

/**
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient; status?: string; limit?: number }} [opts]
 */
export async function fetchComplianceScreenings(opts = {}) {
  const client = opts.supabaseClient || defaultClient;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  let q = client.from(SCREENING_TABLE).select(SELECT_COLS).order("screened_at", { ascending: false }).limit(limit);
  if (opts.status && STATUS_SET.has(opts.status)) {
    q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return { rows: [], tableMissing: true, error: error.message };
    return { rows: [], error: error.message };
  }
  return { rows: data || [] };
}

/**
 * Admin resolve screening result.
 * @param {{
 *   screeningId: string;
 *   status: string;
 *   adminUserId: string;
 *   overrideReason?: string | null;
 *   notes?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function resolveComplianceScreening({
  screeningId,
  status,
  adminUserId,
  overrideReason = null,
  notes = null,
  supabaseClient,
} = {}) {
  const id = typeof screeningId === "string" ? screeningId.trim() : "";
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const nextStatus = String(status || "").toLowerCase();
  if (!id || !adminId || !STATUS_SET.has(nextStatus) || nextStatus === "pending_review") {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const now = new Date().toISOString();
  const patch = {
    status: nextStatus,
    reviewed_at: now,
    reviewed_by: adminId,
    override_reason:
      nextStatus === "manual_override" && overrideReason?.trim() ? overrideReason.trim().slice(0, 1000) : null,
    notes: notes?.trim() ? notes.trim().slice(0, 2000) : null,
    updated_at: now,
  };

  const { data, error } = await client
    .from(SCREENING_TABLE)
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: "compliance_screening_resolved",
    category: "security",
    severity: nextStatus === "rejected" ? "high" : "info",
    targetUserId: data?.user_id ?? null,
    metadata: { screening_id: id, status: nextStatus, screening_type: data?.screening_type },
    supabaseClient: client,
  });

  return { ok: true, screening: data };
}

/**
 * External vendor adapter hook — returns pending_review row without calling vendor in TLP-005.
 * Future: plug ComplyAdvantage / Persona / etc. here.
 * @param {Parameters<typeof queueComplianceScreening>[0]} args
 */
export async function runScreeningHook(args) {
  return queueComplianceScreening(args);
}
