/**
 * Treasury reporting ledger helpers (Phase 1).
 * NOT the authoritative financial ledger — see docs/certification/LEDGER_ARCHITECTURE_DECISION.md.
 * Authoritative system of record: public.transactions + public.wallets.wallet_balance.
 * Manual journal entries only; no automatic posts from wallet or payment flows.
 * `createJournalEntry` is safe for callers (never throws); use a service-role or admin
 * Supabase client from server routes — admin UI Phase 1 is read-only.
 */

import { logOperationalError, sanitizeOperationalMetadata } from "./operationalLogger.js";

const BALANCE_EPS = 1e-9;

/** @param {unknown} v */
function toNum(v) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {unknown} id
 * @returns {boolean}
 */
function isUuidLike(id) {
  if (id == null || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function supabaseErrMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  return String(err);
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isMissingRelationError(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (code === "42P01") return true;
  const msg = supabaseErrMessage(err).toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache");
}

/**
 * @param {{ supabaseClient: import('@supabase/supabase-js').SupabaseClient }}
 * @returns {Promise<{ accounts: object[], error?: string }>}
 */
export async function fetchLedgerAccounts({ supabaseClient }) {
  try {
    if (!supabaseClient) return { accounts: [], error: "No Supabase client" };
    const { data, error } = await supabaseClient
      .from("ledger_accounts")
      .select("id, code, name, account_type, status, metadata, created_at, updated_at")
      .order("code", { ascending: true });
    if (error) {
      return { accounts: [], error: supabaseErrMessage(error) };
    }
    return { accounts: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { accounts: [], error: supabaseErrMessage(e) };
  }
}

/**
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient
 * @param {number} [args.limit]
 * @param {string|null} [args.beforeIso] — exclusive cursor on created_at (newest-first pages)
 * @param {string|null} [args.sourceType]
 * @param {string|null} [args.sourceId]
 * @returns {Promise<{ entries: object[], error?: string }>}
 */
export async function fetchJournalEntries({
  supabaseClient,
  limit = 50,
  beforeIso = null,
  sourceType = null,
  sourceId = null,
}) {
  try {
    if (!supabaseClient) return { entries: [], error: "No Supabase client" };
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));
    let q = supabaseClient
      .from("journal_entries")
      .select("id, entry_type, source_type, source_id, description, status, created_by, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(lim);
    if (beforeIso && typeof beforeIso === "string") {
      q = q.lt("created_at", beforeIso);
    }
    if (sourceType && typeof sourceType === "string" && sourceType !== "all") {
      q = q.eq("source_type", sourceType);
    }
    if (sourceId != null && String(sourceId).trim()) {
      q = q.eq("source_id", String(sourceId).trim());
    }
    const { data, error } = await q;
    if (error) {
      return { entries: [], error: supabaseErrMessage(error) };
    }
    return { entries: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { entries: [], error: supabaseErrMessage(e) };
  }
}

/**
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient
 * @param {string} args.entryId
 * @returns {Promise<{ lines: object[], error?: string }>}
 */
export async function fetchJournalLines({ supabaseClient, entryId }) {
  try {
    if (!supabaseClient) return { lines: [], error: "No Supabase client" };
    if (!isUuidLike(String(entryId || ""))) {
      return { lines: [], error: "Invalid entry id" };
    }
    const { data: lines, error: lineErr } = await supabaseClient
      .from("journal_lines")
      .select("id, journal_entry_id, account_id, debit, credit, currency, user_id, metadata, created_at")
      .eq("journal_entry_id", entryId)
      .order("created_at", { ascending: true });
    if (lineErr) {
      return { lines: [], error: supabaseErrMessage(lineErr) };
    }
    const raw = Array.isArray(lines) ? lines : [];
    const accountIds = [...new Set(raw.map((r) => r.account_id).filter(Boolean))];
    if (accountIds.length === 0) {
      return { lines: raw };
    }
    const { data: accounts, error: accErr } = await supabaseClient
      .from("ledger_accounts")
      .select("id, code, name, account_type")
      .in("id", accountIds);
    if (accErr) {
      return { lines: raw, error: supabaseErrMessage(accErr) };
    }
    const byId = Object.fromEntries((accounts || []).map((a) => [a.id, a]));
    const merged = raw.map((row) => {
      const a = byId[row.account_id];
      return {
        ...row,
        account_code: a?.code ?? null,
        account_name: a?.name ?? null,
        account_type: a?.account_type ?? null,
      };
    });
    return { lines: merged };
  } catch (e) {
    return { lines: [], error: supabaseErrMessage(e) };
  }
}

/**
 * Posted-entry line ids for trial balance (batched .in()).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<string[]|null>}
 */
async function fetchPostedJournalEntryIds(client) {
  const { data, error } = await client.from("journal_entries").select("id").eq("status", "posted");
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r) => r.id).filter(Boolean);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} ids
 */
async function fetchLinesForEntryIds(client, ids) {
  const chunkSize = 100;
  /** @type {object[]} */
  const out = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("journal_lines")
      .select("account_id, debit, credit")
      .in("journal_entry_id", chunk);
    if (error) throw error;
    if (Array.isArray(data)) out.push(...data);
  }
  return out;
}

/**
 * @param {{ supabaseClient: import('@supabase/supabase-js').SupabaseClient }}
 * @returns {Promise<{
 *   accounts: object[],
 *   totalDebits: number,
 *   totalCredits: number,
 *   imbalance: number,
 *   error?: string
 * }>}
 */
export async function calculateLedgerTrialBalance({ supabaseClient }) {
  const empty = {
    accounts: [],
    totalDebits: 0,
    totalCredits: 0,
    imbalance: 0,
  };
  try {
    if (!supabaseClient) {
      return { ...empty, error: "No Supabase client" };
    }

    const { accounts: coaRows, error: coaErr } = await fetchLedgerAccounts({ supabaseClient });
    if (coaErr && isMissingRelationError({ message: coaErr })) {
      return { ...empty, error: coaErr };
    }

    let entryIds = [];
    try {
      entryIds = (await fetchPostedJournalEntryIds(supabaseClient)) || [];
    } catch (e) {
      if (isMissingRelationError(e)) {
        return { ...empty, error: supabaseErrMessage(e) };
      }
      return { ...empty, error: supabaseErrMessage(e) };
    }

    /** @type {Map<string, { debit: number, credit: number }>} */
    const sums = new Map();
    if (entryIds.length > 0) {
      try {
        const lineRows = await fetchLinesForEntryIds(supabaseClient, entryIds);
        for (const row of lineRows) {
          const aid = row.account_id;
          if (!aid) continue;
          const cur = sums.get(aid) || { debit: 0, credit: 0 };
          cur.debit += toNum(row.debit);
          cur.credit += toNum(row.credit);
          sums.set(aid, cur);
        }
      } catch (e) {
        return {
          ...empty,
          accounts: (coaRows || []).map((a) => ({
            accountId: a.id,
            code: a.code,
            name: a.name,
            accountType: a.account_type,
            totalDebit: 0,
            totalCredit: 0,
            net: 0,
          })),
          error: supabaseErrMessage(e),
        };
      }
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const accounts = (coaRows || []).map((a) => {
      const s = sums.get(a.id) || { debit: 0, credit: 0 };
      totalDebits += s.debit;
      totalCredits += s.credit;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        accountType: a.account_type,
        totalDebit: s.debit,
        totalCredit: s.credit,
        net: s.debit - s.credit,
      };
    });

    const imbalance = totalDebits - totalCredits;
    return {
      accounts,
      totalDebits,
      totalCredits,
      imbalance,
      ...(coaErr ? { error: coaErr } : {}),
    };
  } catch (e) {
    return { ...empty, error: supabaseErrMessage(e) };
  }
}

/**
 * @param {unknown} lines
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateJournalLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Lines must be a non-empty array" };
  }
  let sumD = 0;
  let sumC = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || typeof row !== "object") {
      return { ok: false, error: `Line ${i + 1}: invalid row` };
    }
    const accountId = row.accountId ?? row.account_id;
    if (!isUuidLike(String(accountId || ""))) {
      return { ok: false, error: `Line ${i + 1}: missing or invalid accountId` };
    }
    const debit = toNum(row.debit);
    const credit = toNum(row.credit);
    if (debit < 0 || credit < 0) {
      return { ok: false, error: `Line ${i + 1}: debit/credit must be non-negative` };
    }
    if (debit > 0 && credit > 0) {
      return { ok: false, error: `Line ${i + 1}: only one of debit or credit may be positive` };
    }
    if (debit === 0 && credit === 0) {
      return { ok: false, error: `Line ${i + 1}: either debit or credit must be positive` };
    }
    const currency = row.currency != null ? String(row.currency) : "USD";
    if (!currency.trim()) {
      return { ok: false, error: `Line ${i + 1}: currency is required` };
    }
    sumD += debit;
    sumC += credit;
  }
  if (Math.abs(sumD - sumC) > BALANCE_EPS) {
    return {
      ok: false,
      error: `Debits (${sumD}) and credits (${sumC}) must balance`,
    };
  }
  return { ok: true };
}

/**
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient
 * @param {string} args.entryType
 * @param {string} args.sourceType
 * @param {string|null} [args.sourceId]
 * @param {string|null} [args.description]
 * @param {object[]} args.lines
 * @param {Record<string, unknown>} [args.metadata]
 * @param {string|null} [args.createdByUserId]
 * @param {'draft'|'posted'|'void'} [args.status]
 * @returns {Promise<{ ok: boolean, entryId?: string, error?: string }>}
 */
export async function createJournalEntry({
  supabaseClient,
  entryType,
  sourceType,
  sourceId = null,
  description = null,
  lines,
  metadata = {},
  createdByUserId = null,
  status = "posted",
}) {
  try {
    if (!supabaseClient) {
      return { ok: false, error: "No Supabase client" };
    }
    const v = validateJournalLines(lines);
    if (!v.ok) {
      return { ok: false, error: v.error || "Invalid lines" };
    }

    const entryRow = {
      entry_type: String(entryType || "").slice(0, 256) || "unknown",
      source_type: String(sourceType || "").slice(0, 256) || "unknown",
      source_id: sourceId != null ? String(sourceId).slice(0, 2000) : null,
      description: description != null ? String(description).slice(0, 8000) : null,
      status: status === "draft" || status === "void" ? status : "posted",
      created_by: createdByUserId && isUuidLike(createdByUserId) ? createdByUserId : null,
      metadata: sanitizeOperationalMetadata(metadata),
    };

    const { data: insertedEntry, error: e1 } = await supabaseClient
      .from("journal_entries")
      .insert(entryRow)
      .select("id")
      .maybeSingle();

    if (e1 || !insertedEntry?.id) {
      await logOperationalError({
        category: "ledger.journal_entry",
        message: "journal_entries insert failed",
        metadata: sanitizeOperationalMetadata({
          code: e1?.code,
          hint: e1?.hint,
          sourceType: entryRow.source_type,
          entryType: entryRow.entry_type,
          lineCount: Array.isArray(lines) ? lines.length : 0,
        }),
        userId: entryRow.created_by,
      });
      return { ok: false, error: supabaseErrMessage(e1) || "Insert failed" };
    }

    const entryId = insertedEntry.id;
    const linePayload = lines.map((row) => ({
      journal_entry_id: entryId,
      account_id: String(row.accountId ?? row.account_id),
      debit: toNum(row.debit),
      credit: toNum(row.credit),
      currency: row.currency != null ? String(row.currency).slice(0, 16) : "USD",
      user_id: row.userId && isUuidLike(String(row.userId)) ? String(row.userId) : null,
      metadata: sanitizeOperationalMetadata(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
    }));

    const { error: e2 } = await supabaseClient.from("journal_lines").insert(linePayload);
    if (e2) {
      try {
        await supabaseClient.from("journal_entries").delete().eq("id", entryId);
      } catch (delErr) {
        await logOperationalError({
          category: "ledger.journal_entry",
          message: "journal_lines insert failed and entry rollback delete errored",
          metadata: sanitizeOperationalMetadata({
            insertError: supabaseErrMessage(e2),
            rollbackError: supabaseErrMessage(delErr),
            entryId,
            lineCount: linePayload.length,
          }),
          userId: entryRow.created_by,
        });
        return { ok: false, error: supabaseErrMessage(e2) };
      }
      await logOperationalError({
        category: "ledger.journal_entry",
        message: "journal_lines insert failed (entry rolled back)",
        metadata: sanitizeOperationalMetadata({
          code: e2?.code,
          hint: e2?.hint,
          entryId,
          lineCount: linePayload.length,
        }),
        userId: entryRow.created_by,
      });
      return { ok: false, error: supabaseErrMessage(e2) };
    }

    return { ok: true, entryId };
  } catch (e) {
    await logOperationalError({
      category: "ledger.journal_entry",
      message: "createJournalEntry unexpected failure",
      metadata: sanitizeOperationalMetadata({
        error: supabaseErrMessage(e),
      }),
      userId: typeof createdByUserId === "string" ? createdByUserId : null,
    });
    return { ok: false, error: supabaseErrMessage(e) };
  }
}
