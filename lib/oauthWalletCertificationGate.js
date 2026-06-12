/**
 * Tropicash — Phase 13D OAuth wallet sandbox certification gate.
 *
 * Maps Phase 13C certification outcomes to developer/app progression gate
 * statuses. Diagnostics only — no wallet mutation, no money movement, no
 * production approval, and no token or balance exposure.
 */

export const GATE_PHASE = '13D';

/** @typedef {'CERTIFIED' | 'FAILED' | 'INCOMPLETE' | 'NOT_EVALUATED'} CertificationGateStatus */

export const CERTIFICATION_GATE_STATUSES = {
  CERTIFIED: {
    key: 'CERTIFIED',
    label: 'Certified',
    tone: 'ready',
    description:
      'Latest certification status is certified. Wallet-read sandbox progression may proceed for this run/client.',
  },
  FAILED: {
    key: 'FAILED',
    label: 'Failed',
    tone: 'blocked',
    description:
      'Latest certification status is failed. Resolve certification blockers before progression.',
  },
  INCOMPLETE: {
    key: 'INCOMPLETE',
    label: 'Incomplete',
    tone: 'warn',
    description:
      'Latest certification status is incomplete. Complete all required harness steps and re-evaluate.',
  },
  NOT_EVALUATED: {
    key: 'NOT_EVALUATED',
    label: 'Not evaluated',
    tone: 'info',
    description:
      'No certification record exists for this run/client. Evaluate harness evidence first.',
  },
};

const CERT_TO_GATE = {
  certified: 'CERTIFIED',
  failed: 'FAILED',
  incomplete: 'INCOMPLETE',
};

/**
 * @returns {CertificationGateStatus[]}
 */
export function getCertificationGateStatuses() {
  return Object.keys(CERTIFICATION_GATE_STATUSES);
}

/**
 * Map a Phase 13C certification status string to a gate status.
 *
 * @param {string | null | undefined} certificationStatus
 * @returns {CertificationGateStatus}
 */
export function mapCertificationStatusToGateStatus(certificationStatus) {
  const key = String(certificationStatus || '').trim().toLowerCase();
  return CERT_TO_GATE[key] || 'NOT_EVALUATED';
}

/**
 * Extract oauth_client_id and developer_app_id from a certification row.
 *
 * @param {object | null | undefined} row
 * @returns {{ oauth_client_id: string | null; developer_app_id: string | null }}
 */
export function extractCertificationContext(row) {
  if (!row || typeof row !== 'object') {
    return { oauth_client_id: null, developer_app_id: null };
  }
  const summary =
    row.summary && typeof row.summary === 'object' ? row.summary : {};
  const oauth_client_id =
    row.oauth_client_id ||
    summary.oauth_client_id ||
    null;
  const developer_app_id =
    row.developer_app_id ||
    summary.developer_app_id ||
    null;
  return {
    oauth_client_id: oauth_client_id ? String(oauth_client_id) : null,
    developer_app_id: developer_app_id ? String(developer_app_id) : null,
  };
}

/**
 * Evaluate gate status for a single certification row (or NOT_EVALUATED if absent).
 *
 * @param {object | null | undefined} certificationRow
 * @returns {{
 *   gateStatus: CertificationGateStatus;
 *   gateMeta: (typeof CERTIFICATION_GATE_STATUSES)[CertificationGateStatus];
 *   certificationStatus: string | null;
 *   run_id: string | null;
 *   oauth_client_id: string | null;
 *   developer_app_id: string | null;
 *   certified_at: string | null;
 *   leak_detected: boolean;
 *   allowsProgression: boolean;
 * }}
 */
export function evaluateCertificationGate(certificationRow) {
  if (!certificationRow) {
    const gateStatus = 'NOT_EVALUATED';
    return {
      gateStatus,
      gateMeta: CERTIFICATION_GATE_STATUSES[gateStatus],
      certificationStatus: null,
      run_id: null,
      oauth_client_id: null,
      developer_app_id: null,
      certified_at: null,
      leak_detected: false,
      allowsProgression: false,
    };
  }

  const certificationStatus = certificationRow.status
    ? String(certificationRow.status).toLowerCase()
    : null;
  const gateStatus = mapCertificationStatusToGateStatus(certificationStatus);
  const ctx = extractCertificationContext(certificationRow);

  return {
    gateStatus,
    gateMeta: CERTIFICATION_GATE_STATUSES[gateStatus],
    certificationStatus,
    run_id: certificationRow.run_id ? String(certificationRow.run_id) : null,
    oauth_client_id: ctx.oauth_client_id,
    developer_app_id: ctx.developer_app_id,
    certified_at: certificationRow.certified_at || null,
    leak_detected: Boolean(certificationRow.leak_detected),
    allowsProgression: gateStatus === 'CERTIFIED',
  };
}

/**
 * Sort certification rows newest first by certified_at.
 *
 * @param {object[]} rows
 * @returns {object[]}
 */
export function sortCertificationsByRecency(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const ta = Date.parse(a?.certified_at || '') || 0;
    const tb = Date.parse(b?.certified_at || '') || 0;
    return tb - ta;
  });
}

/**
 * Pick the latest certification row per run_id.
 *
 * @param {object[]} rows
 * @returns {Map<string, object>}
 */
export function pickLatestCertificationPerRun(rows) {
  const sorted = sortCertificationsByRecency(rows);
  const map = new Map();
  for (const row of sorted) {
    const runId = row?.run_id ? String(row.run_id) : null;
    if (!runId || map.has(runId)) continue;
    map.set(runId, row);
  }
  return map;
}

/**
 * Pick the latest certification row per oauth_client_id (where client is known).
 *
 * @param {object[]} rows
 * @returns {Map<string, object>}
 */
export function pickLatestCertificationPerClient(rows) {
  const sorted = sortCertificationsByRecency(rows);
  const map = new Map();
  for (const row of sorted) {
    const { oauth_client_id } = extractCertificationContext(row);
    if (!oauth_client_id || map.has(oauth_client_id)) continue;
    map.set(oauth_client_id, row);
  }
  return map;
}

/**
 * Developer/app progression rule — only CERTIFIED allows wallet-read sandbox progression.
 *
 * @param {CertificationGateStatus} gateStatus
 * @returns {boolean}
 */
export function allowsWalletReadSandboxProgression(gateStatus) {
  return gateStatus === 'CERTIFIED';
}

/**
 * Human-readable progression rule for a gate status.
 *
 * @param {CertificationGateStatus} gateStatus
 * @returns {string}
 */
export function getDeveloperProgressionRule(gateStatus) {
  const meta = CERTIFICATION_GATE_STATUSES[gateStatus] || CERTIFICATION_GATE_STATUSES.NOT_EVALUATED;
  return meta.description;
}

/**
 * Build admin/report rows with gate evaluation for each certification record.
 *
 * @param {object[]} certificationRows
 * @returns {Array<ReturnType<typeof evaluateCertificationGate> & { id: string | null; passed_count: number; failed_count: number; skipped_count: number }>}
 */
export function summarizeCertificationGateRows(certificationRows) {
  const sorted = sortCertificationsByRecency(certificationRows);
  return sorted.map((row) => {
    const gate = evaluateCertificationGate(row);
    return {
      id: row.id ?? null,
      passed_count: Number(row.passed_count) || 0,
      failed_count: Number(row.failed_count) || 0,
      skipped_count: Number(row.skipped_count) || 0,
      ...gate,
    };
  });
}

/**
 * Gate summary counts across a set of certification rows (latest per run).
 *
 * @param {object[]} certificationRows
 * @returns {{
 *   phase: string;
 *   totalRuns: number;
 *   certified: number;
 *   failed: number;
 *   incomplete: number;
 *   notEvaluated: number;
 *   latestPerClient: number;
 * }}
 */
export function getCertificationGateSummary(certificationRows) {
  const latestByRun = pickLatestCertificationPerRun(certificationRows);
  const counts = { certified: 0, failed: 0, incomplete: 0, notEvaluated: 0 };

  for (const row of latestByRun.values()) {
    const gateStatus = evaluateCertificationGate(row).gateStatus;
    if (gateStatus === 'CERTIFIED') counts.certified += 1;
    else if (gateStatus === 'FAILED') counts.failed += 1;
    else if (gateStatus === 'INCOMPLETE') counts.incomplete += 1;
    else counts.notEvaluated += 1;
  }

  return {
    phase: GATE_PHASE,
    totalRuns: latestByRun.size,
    ...counts,
    latestPerClient: pickLatestCertificationPerClient(certificationRows).size,
  };
}

/**
 * Resolve gate for a specific run_id from a certification row set.
 *
 * @param {object[]} certificationRows
 * @param {string} runId
 * @returns {ReturnType<typeof evaluateCertificationGate>}
 */
export function resolveGateForRunId(certificationRows, runId) {
  const rid = String(runId || '').trim();
  if (!rid) return evaluateCertificationGate(null);

  const match = (Array.isArray(certificationRows) ? certificationRows : []).find(
    (r) => String(r.run_id) === rid,
  );
  return evaluateCertificationGate(match || null);
}

/**
 * Resolve gate for a specific oauth_client_id using latest certification.
 *
 * @param {object[]} certificationRows
 * @param {string} oauthClientId
 * @returns {ReturnType<typeof evaluateCertificationGate>}
 */
export function resolveGateForClientId(certificationRows, oauthClientId) {
  const cid = String(oauthClientId || '').trim();
  if (!cid) return evaluateCertificationGate(null);

  const latest = pickLatestCertificationPerClient(certificationRows).get(cid);
  return evaluateCertificationGate(latest || null);
}
