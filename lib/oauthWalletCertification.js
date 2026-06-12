/**
 * Tropicash — Phase 13C OAuth wallet sandbox pass/fail certification.
 *
 * Evaluates saved harness evidence rows for a single run_id. Diagnostics only —
 * no wallet mutation, no money movement, no new OAuth capabilities.
 */

export const CERTIFICATION_PHASE = '13C';

export const CERTIFICATION_STATUSES = ['certified', 'failed', 'incomplete'];

/** Safe wallet-api failure errors that still allow certification. */
export const SAFE_WALLET_API_ERRORS = new Set([
  'consent_required',
  'insufficient_scope',
  'invalid_token',
  'rate_limit_exceeded',
]);

const MASKED = '[MASKED]';
const REDACTED_BALANCE = '[REDACTED_BALANCE]';

const TOKEN_PREFIX = /^(tc_secret_|tc_auth_|tc_at_|tc_rt_)[A-Za-z0-9]+$/;

const SENSITIVE_KEYS = new Set([
  'client_secret',
  'authorization_code',
  'access_token',
  'refresh_token',
  'token_hash',
  'client_secret_hash',
]);

const BALANCE_KEYS = new Set(['available_balance', 'balance', 'wallet_balance']);

const LEAK_BLOCK_KEYS = new Set([
  'transactions',
  'transaction_history',
  'payment_methods',
  'payment_method',
  'linked_bank_accounts',
]);

/** Harness step_key aliases mapped to canonical certification step ids. */
export const STEP_KEY_ALIASES = {
  consent: 'open-consent',
  'confirm-revoked': 'revoked-token-check',
};

/**
 * @returns {Array<{ key: string; label: string; critical: boolean }>}
 */
export function getCertificationRequiredSteps() {
  return [
    { key: 'select-client', label: 'Select OAuth Client', critical: false },
    { key: 'authorization-url', label: 'Generate Authorization URL', critical: false },
    { key: 'open-consent', label: 'Open Consent Screen', critical: false },
    { key: 'capture-code', label: 'Capture Authorization Code', critical: false },
    { key: 'token-exchange', label: 'Exchange Code for Tokens', critical: true },
    { key: 'profile-api', label: 'Call OAuth Profile API', critical: true },
    { key: 'wallet-api', label: 'Call OAuth Wallet API', critical: true },
    { key: 'refresh-token', label: 'Refresh Token', critical: true },
    { key: 'revoke-token', label: 'Revoke Token', critical: true },
    { key: 'revoked-token-check', label: 'Confirm Revoked Token Fails', critical: true },
  ];
}

/**
 * Normalize a harness evidence step_key to its canonical certification id.
 *
 * @param {string} stepKey
 * @returns {string}
 */
export function normalizeCertificationStepKey(stepKey) {
  const k = String(stepKey || '').trim();
  return STEP_KEY_ALIASES[k] || k;
}

/**
 * @param {object[]} runRows
 * @returns {Map<string, object>}
 */
function indexRowsByCanonicalStep(runRows) {
  const map = new Map();
  for (const row of Array.isArray(runRows) ? runRows : []) {
    const canonical = normalizeCertificationStepKey(row.step_key);
    const existing = map.get(canonical);
    if (!existing || String(row.created_at) > String(existing.created_at)) {
      map.set(canonical, row);
    }
  }
  return map;
}

/**
 * Extract API error code from a sanitized evidence result payload.
 *
 * @param {object} row
 * @returns {string|null}
 */
function extractResultError(row) {
  const result = row?.sanitized_result;
  if (!result || typeof result !== 'object') return null;
  const body = result.body;
  if (body && typeof body === 'object' && body.error) {
    return String(body.error).toLowerCase();
  }
  if (result.error) {
    return String(result.error).toLowerCase();
  }
  return null;
}

/**
 * Whether wallet-api evidence satisfies pass criteria (including safe failures).
 *
 * @param {object|null} row
 * @returns {{ ok: boolean; reason: string }}
 */
export function evaluateWalletApiStep(row) {
  if (!row) {
    return { ok: false, reason: 'missing_wallet_api_evidence' };
  }
  const status = String(row.status || '').toLowerCase();
  if (status === 'passed') {
    return { ok: true, reason: 'wallet_api_passed' };
  }
  const err = extractResultError(row);
  if (err && SAFE_WALLET_API_ERRORS.has(err)) {
    return { ok: true, reason: `safe_wallet_failure:${err}` };
  }
  return { ok: false, reason: err ? `unsafe_wallet_failure:${err}` : 'wallet_api_failed' };
}

/**
 * Scan evidence sanitized_result payloads for disallowed leaked data.
 *
 * @param {object[]} runRows
 * @returns {{ leakDetected: boolean; leaks: string[] }}
 */
export function detectEvidenceLeaks(runRows) {
  const leaks = [];

  function walk(value, path = '') {
    if (value == null) return;

    if (typeof value === 'string') {
      const s = value.trim();
      if (TOKEN_PREFIX.test(s)) {
        leaks.push(`${path}: visible_token`);
        return;
      }
      if (BALANCE_KEYS.has(path.split('.').pop() || '')) {
        if (s !== REDACTED_BALANCE && /^\d+(\.\d+)?$/.test(s)) {
          leaks.push(`${path}: visible_balance`);
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      if (path.endsWith('transactions') || path.includes('.transactions')) {
        leaks.push(`${path}: transaction_array`);
      }
      for (let i = 0; i < value.length; i += 1) {
        walk(value[i], `${path}[${i}]`);
      }
      return;
    }

    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const lk = k.toLowerCase();
        const childPath = path ? `${path}.${k}` : k;

        if (SENSITIVE_KEYS.has(lk) && v !== MASKED) {
          leaks.push(`${childPath}: sensitive_key_leak`);
          continue;
        }
        if (LEAK_BLOCK_KEYS.has(lk)) {
          leaks.push(`${childPath}: blocked_field`);
          continue;
        }
        if (BALANCE_KEYS.has(lk) && v !== REDACTED_BALANCE) {
          if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()))) {
            leaks.push(`${childPath}: visible_balance`);
            continue;
          }
        }
        walk(v, childPath);
      }
    }
  }

  for (const row of Array.isArray(runRows) ? runRows : []) {
    walk(row.sanitized_result, row.step_key || 'result');
  }

  const unique = Array.from(new Set(leaks));
  return { leakDetected: unique.length > 0, leaks: unique };
}

/**
 * Evaluate a full evidence run for OAuth wallet sandbox certification.
 *
 * @param {object[]} runRows
 * @returns {{
 *   status: 'certified' | 'failed' | 'incomplete';
 *   requiredSteps: Array<{ key: string; label: string; present: boolean; stepStatus: string | null; critical: boolean; ok: boolean; reason: string }>;
 *   missingSteps: string[];
 *   leakDetected: boolean;
 *   leaks: string[];
 *   passedCount: number;
 *   failedCount: number;
 *   skippedCount: number;
 *   reasons: string[];
 *   run_id: string | null;
 *   user_id: string | null;
 * }}
 */
export function evaluateOAuthWalletEvidenceRun(runRows) {
  const rows = Array.isArray(runRows) ? runRows : [];
  const byStep = indexRowsByCanonicalStep(rows);
  const required = getCertificationRequiredSteps();
  const leakScan = detectEvidenceLeaks(rows);

  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  for (const row of rows) {
    const s = String(row.status || '').toLowerCase();
    if (s === 'passed') passedCount += 1;
    else if (s === 'failed') failedCount += 1;
    else skippedCount += 1;
  }

  const missingSteps = [];
  const reasons = [];
  const stepResults = [];

  for (const step of required) {
    const row = byStep.get(step.key) || null;
    const present = Boolean(row);
    const stepStatus = row ? String(row.status || '').toLowerCase() : null;

    let ok = present;
    let reason = present ? 'present' : 'missing';

    if (!present) {
      missingSteps.push(step.key);
      ok = false;
    } else if (step.key === 'wallet-api') {
      const walletEval = evaluateWalletApiStep(row);
      ok = walletEval.ok;
      reason = walletEval.reason;
    } else if (step.critical) {
      ok = stepStatus === 'passed';
      reason = ok ? 'passed' : `critical_step_${stepStatus || 'unknown'}`;
    } else {
      ok = stepStatus === 'passed' || stepStatus === 'skipped';
      reason = stepStatus || 'unknown';
    }

    if (step.critical && !ok) {
      reasons.push(`${step.key}: ${reason}`);
    }

    stepResults.push({
      key: step.key,
      label: step.label,
      present,
      stepStatus,
      critical: step.critical,
      ok,
      reason,
    });
  }

  if (leakScan.leakDetected) {
    reasons.push(`leaks: ${leakScan.leaks.join(', ')}`);
  }

  let status = 'certified';

  if (missingSteps.length > 0) {
    status = 'incomplete';
    reasons.unshift(`missing_steps: ${missingSteps.join(', ')}`);
  } else if (leakScan.leakDetected || reasons.length > 0) {
    status = 'failed';
  }

  const first = rows[0] || null;

  return {
    status,
    requiredSteps: stepResults,
    missingSteps,
    leakDetected: leakScan.leakDetected,
    leaks: leakScan.leaks,
    passedCount,
    failedCount,
    skippedCount,
    reasons,
    run_id: first?.run_id ?? null,
    user_id: first?.user_id ?? null,
    developer_app_id: first?.developer_app_id ?? null,
    oauth_client_id: first?.oauth_client_id ?? null,
  };
}

/**
 * Build a persistence-friendly certification summary object.
 *
 * @param {object[]} runRows
 * @returns {ReturnType<typeof evaluateOAuthWalletEvidenceRun> & { phase: string; evaluated_at: string }}
 */
export function summarizeCertification(runRows) {
  const evaluation = evaluateOAuthWalletEvidenceRun(runRows);
  return {
    ...evaluation,
    phase: CERTIFICATION_PHASE,
    evaluated_at: new Date().toISOString(),
  };
}
