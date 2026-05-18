/**
 * Tropicash Developer Center — Phase 5A credential architecture & vault blueprint.
 *
 * Pure static modeling: no Date.now, Math.random, fetch, or Supabase. Describes how
 * credential metadata, lifecycle, rotation, signing concepts, and vault strategies
 * are intended to align before any real API key issuance exists.
 */

export const DEVELOPER_CREDENTIAL_PHASE = "phase_5a_credentials";

/** Keys must stay aligned with `credential_type` CHECK in supabase/sql/developer_credentials_phase5a.sql */
export const CREDENTIAL_TYPES = [
  {
    key: "sandbox_api_key",
    label: "Sandbox API key",
    summary: "Isolated rehearsal identity for non-production traffic and contract drills.",
  },
  {
    key: "live_api_key",
    label: "Live API key",
    summary: "Production-graded identity issued only after governance and vault readiness.",
  },
  {
    key: "webhook_signing_key",
    label: "Webhook signing key",
    summary: "Separate material for verifying inbound platform events at your receiver.",
  },
  {
    key: "service_account_token",
    label: "Service account token",
    summary: "Machine-to-machine flows that never reuse interactive user sessions.",
  },
  {
    key: "oauth_client_credentials",
    label: "OAuth client credentials",
    summary: "Confidential-client style flows where rotation and audience binding matter.",
  },
];

/** Aligned with `lifecycle_status` CHECK on developer_app_credentials */
export const CREDENTIAL_LIFECYCLE_STATUSES = [
  { key: "draft", label: "Draft", narrative: "Row reserved; no issuance started." },
  { key: "pending_issuance", label: "Pending issuance", narrative: "Admin or system workflow acknowledged the slot." },
  { key: "active", label: "Active", narrative: "Vault slot bound; callers may authenticate when the edge exists." },
  { key: "rotation_pending", label: "Rotation pending", narrative: "Successor material scheduled; overlap window governed by policy." },
  { key: "rotating", label: "Rotating", narrative: "Dual-trust or cutover window per rotation model." },
  { key: "suspended", label: "Suspended", narrative: "Temporarily unusable — disputes, abuse review, or billing pause." },
  { key: "revoked", label: "Revoked", narrative: "Material invalidated at the vault; metadata row may remain for audit." },
  { key: "expired", label: "Expired", narrative: "Natural TTL reached; renewal requires a new issuance path." },
];

/** Aligned with `rotation_status` CHECK on developer_app_credentials */
export const CREDENTIAL_ROTATION_STATUSES = [
  { key: "not_started", label: "Not started" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
];

/** Shared risk vocabulary for credentials and attached policies */
export const CREDENTIAL_RISK_LEVELS = [
  { key: "low", label: "Low", hint: "Read-only or tightly bounded rehearsal scopes." },
  { key: "medium", label: "Medium", hint: "Standard money-adjacent sandbox rehearsal." },
  { key: "high", label: "High", hint: "Broad capabilities or live-adjacent paths." },
  { key: "critical", label: "Critical", hint: "Live money movement, payout release, or cross-platform bridges." },
];

/** Conceptual signing primitives — documentation only */
export const CREDENTIAL_SIGNING_MODELS = {
  hmac: {
    key: "hmac",
    title: "HMAC request signing",
    description:
      "Symmetric proof-of-possession over a canonical string (method, path, body hash, timestamps). Secret bytes never leave the vault edge.",
    headers: ["Authorization (scheme)", "X-Tc-Content-Sha256 (illustrative)", "X-Tc-Timestamp (illustrative)"],
  },
  timestamp: {
    key: "timestamp",
    title: "Timestamp skew windows",
    description:
      "Reject replays outside a narrow clock skew. Pairs with nonce or request-id deduplication at the edge.",
    headers: ["Date / X-Tc-Timestamp (illustrative)"],
  },
  nonce: {
    key: "nonce",
    title: "Nonce / idempotency",
    description:
      "One-time request identifiers so retried SDK calls cannot be double-applied when the network flaps.",
    headers: ["Idempotency-Key", "X-Tc-Nonce (illustrative)"],
  },
  webhook_verify: {
    key: "webhook_verify",
    title: "Webhook signature verification",
    description:
      "Platform signs payload + timestamp; receiver recomputes with the webhook signing key handle from the vault.",
    headers: ["X-Tc-Signature (illustrative)", "X-Tc-Timestamp (illustrative)"],
  },
};

/** Static vault posture descriptions — no vendor names required */
export const CREDENTIAL_VAULT_STRATEGIES = {
  envelope_encryption: {
    key: "envelope_encryption",
    title: "Envelope encryption",
    body: "Data keys encrypt secret material; root keys stay in HSM or cloud KMS. Database rows store handles only.",
  },
  dual_control: {
    key: "dual_control",
    title: "Dual control issuance",
    body: "Break-glass and live issuance require two human approvals or separated automation roles.",
  },
  break_glass: {
    key: "break_glass",
    title: "Break-glass access",
    body: "Time-boxed, audited administrator access to decrypt or re-wrap keys with post-incident review.",
  },
  zero_plaintext_console: {
    key: "zero_plaintext_console",
    title: "Zero plaintext in console",
    body: "Developer Console shows at most a prefix once; full material is download-once or never displayed again.",
  },
};

export const CREDENTIAL_SECURITY_RULES = [
  "Owners may read credential metadata for their apps; they never INSERT or UPDATE credential rows (issuance is admin-only at the RLS layer).",
  "Lifecycle and access-policy tables are append-oriented for audit; destructive edits stay admin-gated.",
  "Sandbox and live material use separate vault namespaces and correlation references — no shared symmetric keys across environments.",
  "Rotation states must be visible on the credential row before live cutover is considered complete.",
  "Webhook signing keys are distinct from API transport keys to limit blast radius when a receiver is compromised.",
];

export const CREDENTIAL_PREFIX_MODELS = [
  {
    key: "sandbox_publishable",
    label: "Sandbox publishable prefix (example shape)",
    example: "tc_sbx_pub_00000000_",
    note: "Illustrative only — not a real key or entropy.",
  },
  {
    key: "sandbox_secret",
    label: "Sandbox secret prefix (example shape)",
    example: "tc_sbx_sec_00000000_",
    note: "Illustrative only — production systems would never log the suffix.",
  },
  {
    key: "live_publishable",
    label: "Live publishable prefix (example shape)",
    example: "tc_live_pub_00000000_",
    note: "Illustrative only — live issuance remains closed in this repository phase.",
  },
];

export const CREDENTIAL_ROTATION_MODELS = [
  {
    key: "overlap_dual_valid",
    label: "Overlapping dual-valid",
    summary: "Old and new handles both verify for a bounded window while SDKs roll out.",
  },
  {
    key: "hard_cutover",
    label: "Hard cutover",
    summary: "Instant flip at a scheduled second — smallest vault complexity, highest coordination burden.",
  },
  {
    key: "just_in_time_rewrap",
    label: "JIT rewrap",
    summary: "Clients fetch short-lived session proofs while long-lived vault handles rotate underneath.",
  },
];

export const CREDENTIAL_REVOCATION_MODELS = [
  {
    key: "immediate_invalidate",
    label: "Immediate invalidation",
    summary: "Edge caches drop trust in the handle on the same revocation event.",
  },
  {
    key: "grace_ttl",
    label: "Grace TTL",
    summary: "Allow in-flight requests to drain for N minutes while new auth is rejected.",
  },
  {
    key: "scoped_revoke",
    label: "Scoped revoke",
    summary: "Revoke only one capability slice without touching sibling credentials on the app.",
  },
];

export const CREDENTIAL_SIGNING_EXAMPLES = [
  {
    title: "Canonical string (illustrative)",
    lines: ["POST\n/sandbox/v1/example\n1735689600\nsha256=0000000000000000000000000000000000000000000000000000000000000000"],
    caption: "Concatenation order is documentation-only; not a live signing spec.",
  },
  {
    title: "Webhook body digest (illustrative)",
    lines: ["v1=0000000000000000000000000000000000000000000000000000000000000000"],
    caption: "Hex placeholders only — never paste production digests into tickets.",
  },
];

export const CREDENTIAL_VAULT_BLUEPRINTS = [
  {
    key: "metadata_row",
    title: "Supabase metadata row",
    bullets: [
      "Stores lifecycle, rotation state, risk, prefix hint, correlation_reference — never ciphertext of the secret.",
      "RLS: owner SELECT; admin CRUD for issuance workflows.",
    ],
  },
  {
    key: "vault_handle",
    title: "External vault handle",
    bullets: [
      "correlation_reference links to KMS or HSM object versions without exposing raw bytes.",
      "Break-glass and rotation events append to developer_credential_lifecycle_events.",
    ],
  },
  {
    key: "policy_attachment",
    title: "Access policy JSON",
    bullets: [
      "developer_credential_access_policies.policy_value holds capability slices, IP allowlists, or review flags as documentation-shaped JSON.",
      "Owners read; admins write — same split as credential rows.",
    ],
  },
];

function joinKeys(items, key = "key") {
  return items.map((x) => x[key]).join(", ");
}

export function buildCredentialLifecycleSummary() {
  return `Phase 5A lifecycle states (${CREDENTIAL_LIFECYCLE_STATUSES.length}): ${joinKeys(
    CREDENTIAL_LIFECYCLE_STATUSES,
  )}. Events such as issuance, rotation, and policy attachment are recorded separately for audit.`;
}

export function buildCredentialRotationSummary() {
  return `Rotation statuses (${CREDENTIAL_ROTATION_STATUSES.length}): ${joinKeys(CREDENTIAL_ROTATION_STATUSES)}. Models cover ${CREDENTIAL_ROTATION_MODELS.map((m) => m.label).join(", ")}.`;
}

export function buildCredentialVaultSummary() {
  const titles = Object.values(CREDENTIAL_VAULT_STRATEGIES).map((s) => s.title);
  return `Vault strategies described: ${titles.join("; ")}. Blueprint rows split metadata, vault handles, and JSON policy attachments.`;
}

export function buildSigningModelSummary() {
  return `Signing concepts: ${Object.values(CREDENTIAL_SIGNING_MODELS)
    .map((m) => m.title)
    .join("; ")}.`;
}

export function buildCredentialRiskSummary() {
  return `Risk levels (${CREDENTIAL_RISK_LEVELS.length}): ${joinKeys(CREDENTIAL_RISK_LEVELS)} — applied to both credentials and access policy rows for reviewer alignment.`;
}
