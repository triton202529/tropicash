/**
 * Tropicash — Phase 13B OAuth wallet sandbox test evidence helpers.
 *
 * Sanitizes and submits pass/fail harness step evidence. Never persists secrets,
 * tokens, authorization codes, wallet balances, transactions, or KYC documents.
 */

import { supabase } from './supabaseClient';

export const EVIDENCE_TABLE = 'oauth_wallet_test_evidence';

export const EVIDENCE_STATUSES = ['passed', 'failed', 'skipped'];

const MASKED = '[MASKED]';
const REDACTED_BALANCE = '[REDACTED_BALANCE]';

const SENSITIVE_KEYS = new Set([
  'client_secret',
  'authorization_code',
  'access_token',
  'refresh_token',
  'token_hash',
  'client_secret_hash',
  'code',
  'token',
]);

const BALANCE_KEYS = new Set([
  'available_balance',
  'balance',
  'wallet_balance',
]);

const BLOCKED_KEYS = new Set([
  'transactions',
  'transaction_history',
  'payment_methods',
  'payment_method',
  'linked_bank_accounts',
  'kyc_documents',
  'document_front_url',
  'document_back_url',
  'selfie_url',
  'fraud_score',
  'fraud_scores',
  'risk_score',
  'admin_flags',
  'review_notes',
]);

const TOKEN_PREFIX = /^(tc_secret_|tc_auth_|tc_at_|tc_rt_)/;

/**
 * Generate a unique harness run identifier (session-local; not persisted until saved).
 *
 * @returns {string}
 */
export function generateEvidenceRunId() {
  const ts = Date.now().toString(36);
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    rand = Math.random().toString(36).slice(2, 10);
  }
  return `owt_${ts}_${rand}`;
}

/**
 * Recursively sanitize a value for evidence storage. Masks token prefixes and
 * redacts balances; drops blocked financial/KYC/fraud fields.
 *
 * @param {unknown} value
 * @param {string} [key]
 * @returns {unknown}
 */
export function sanitizeOAuthWalletEvidence(value, key = '') {
  if (value == null) return value;

  const k = String(key).toLowerCase();

  if (BLOCKED_KEYS.has(k)) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (SENSITIVE_KEYS.has(k) || TOKEN_PREFIX.test(trimmed)) {
      return MASKED;
    }
    if (BALANCE_KEYS.has(k)) {
      return REDACTED_BALANCE;
    }
    return value;
  }

  if (typeof value === 'number' && BALANCE_KEYS.has(k)) {
    return REDACTED_BALANCE;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeOAuthWalletEvidence(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [entryKey, entryVal] of Object.entries(value)) {
      const lk = entryKey.toLowerCase();
      if (BLOCKED_KEYS.has(lk)) continue;

      if (lk === 'wallet' && entryVal && typeof entryVal === 'object') {
        const wallet = { ...entryVal };
        if ('available_balance' in wallet) wallet.available_balance = REDACTED_BALANCE;
        if ('balance' in wallet) wallet.balance = REDACTED_BALANCE;
        if ('wallet_balance' in wallet) wallet.wallet_balance = REDACTED_BALANCE;
        out[entryKey] = sanitizeOAuthWalletEvidence(wallet, entryKey);
        continue;
      }

      if (BALANCE_KEYS.has(lk)) {
        out[entryKey] = REDACTED_BALANCE;
        continue;
      }

      if (SENSITIVE_KEYS.has(lk)) {
        out[entryKey] = MASKED;
        continue;
      }

      const sanitized = sanitizeOAuthWalletEvidence(entryVal, entryKey);
      if (sanitized !== undefined) {
        out[entryKey] = sanitized;
      }
    }
    return out;
  }

  return value;
}

/**
 * Build a safe API payload for POST /api/oauth/test-evidence.
 *
 * @param {{
 *   run_id: string;
 *   developer_app_id?: string | null;
 *   oauth_client_id?: string | null;
 *   step_key: string;
 *   step_label: string;
 *   status: 'passed' | 'failed' | 'skipped';
 *   http_status?: number | null;
 *   result?: unknown;
 * }} params
 * @returns {object}
 */
export function buildEvidencePayload(params = {}) {
  const status = EVIDENCE_STATUSES.includes(params.status) ? params.status : 'skipped';
  const rawResult = params.result ?? {};
  const sanitized = sanitizeOAuthWalletEvidence(rawResult);

  return {
    run_id: String(params.run_id || '').trim(),
    developer_app_id: params.developer_app_id ?? null,
    oauth_client_id: params.oauth_client_id ?? null,
    step_key: String(params.step_key || '').trim(),
    step_label: String(params.step_label || '').trim(),
    status,
    http_status: params.http_status == null ? null : Number(params.http_status),
    sanitized_result:
      sanitized && typeof sanitized === 'object' ? sanitized : { note: String(sanitized) },
  };
}

/**
 * Submit one evidence row via the server API (requires logged-in Supabase session).
 *
 * @param {ReturnType<typeof buildEvidencePayload>} payload
 * @returns {Promise<{ ok: boolean; id?: string; error?: string }>}
 */
export async function submitOAuthWalletEvidence(payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return { ok: false, error: 'login_required' };
  }

  try {
    const resp = await fetch('/api/oauth/test-evidence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok && body.ok) {
      return { ok: true, id: body.id };
    }
    return {
      ok: false,
      error: body.error || `request_failed_${resp.status}`,
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'network_error' };
  }
}

/**
 * Summarize evidence rows for a single run_id.
 *
 * @param {Array<{
 *   step_key?: string;
 *   step_label?: string;
 *   status?: string;
 *   http_status?: number | null;
 *   created_at?: string;
 * }>} rows
 * @returns {{
 *   total: number;
 *   passed: number;
 *   failed: number;
 *   skipped: number;
 *   steps: Array<{ step_key: string; step_label: string; status: string; http_status: number | null }>;
 * }}
 */
export function summarizeEvidenceRun(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const steps = list.map((row) => {
    const status = String(row.status || 'skipped').toLowerCase();
    if (status === 'passed') passed += 1;
    else if (status === 'failed') failed += 1;
    else skipped += 1;
    return {
      step_key: row.step_key || '—',
      step_label: row.step_label || '—',
      status,
      http_status: row.http_status == null ? null : Number(row.http_status),
      created_at: row.created_at || null,
    };
  });

  return {
    total: list.length,
    passed,
    failed,
    skipped,
    steps,
  };
}
