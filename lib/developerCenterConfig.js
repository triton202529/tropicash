/**
 * Tropicash Developer Center — internal configuration.
 *
 * Phase 1.5: structural separation between the public Developer Portal
 * (marketing/docs/onboarding), the future authenticated Developer Console
 * (infrastructure management), and the internal Blue Atlantic platform layer
 * (architecture planning only).
 *
 * IMPORTANT — out of scope for this file:
 *   • Live API key generation
 *   • Real payment / wallet / payout / fraud / treasury logic
 *   • Any secrets, environment variable exposure, or runtime credentials
 *
 * This module is consumed by:
 *   • pages/developers/**            (public)
 *   • pages/dev-console/**           (authenticated shell, not functional)
 *   • components/devconsole/**       (shared console layout)
 *   • docs/internal-platform-architecture.md (kept in sync conceptually)
 */

export const DEVELOPER_API_PHASE = "foundation";

export const API_ENVIRONMENTS = ["sandbox", "live"];

export const BLUE_ATLANTIC_PLATFORMS = [
  "Tropicash",
  "EliteHire Pro",
  "Sentinel",
  "Triton",
];

export const DEVELOPER_ACCESS_USE_CASES = [
  { value: "accept_payments", label: "Accept payments" },
  { value: "send_payouts", label: "Send payouts" },
  { value: "wallet_integration", label: "Wallet integration" },
  { value: "blue_atlantic_integration", label: "Blue Atlantic platform integration" },
  { value: "other", label: "Other" },
];

export const DEVELOPER_ACCESS_REQUESTS_TABLE = "developer_access_requests";

/**
 * Public Developer Portal routes — marketing, documentation, onboarding.
 * Reachable without a Supabase session. Keep this list in sync with
 * `PUBLIC_PATHNAMES` in components/RouteAuthGuard.jsx.
 */
export const PUBLIC_DEVELOPER_ROUTES = [
  {
    path: "/developers",
    label: "Overview",
    description: "Tropicash Developer Center landing.",
  },
  {
    path: "/developers/how-it-works",
    label: "How It Works",
    description:
      "Plain-English visual walkthrough of the Tropicash platform architecture.",
  },
  {
    path: "/developers/docs",
    label: "Documentation",
    description: "API documentation preview (not yet active).",
  },
  {
    path: "/developers/pricing",
    label: "Pricing",
    description: "Planned developer pricing tiers.",
  },
  {
    path: "/developers/roadmap",
    label: "Roadmap",
    description: "Staged API rollout plan.",
  },
  {
    path: "/developers/status",
    label: "Status",
    description: "Public platform status.",
  },
  {
    path: "/developers/request-access",
    label: "Request Access",
    description: "Submit a developer access request.",
  },
];

/**
 * Authenticated Developer Console routes — infrastructure management shell.
 * These pages require a Supabase session; unauthenticated users are sent to
 * /login (enforced in components/RouteAuthGuard.jsx).
 *
 * Phase 1.5 ships them as placeholder shells only. No live behavior.
 */
export const DEV_CONSOLE_ROUTES = [
  {
    path: "/dev-console",
    label: "Overview",
    icon: "📊",
    description: "Developer Console home with infrastructure overview.",
  },
  {
    path: "/dev-console/apps",
    label: "Apps",
    icon: "🧩",
    description: "Register and manage developer apps.",
  },
  {
    path: "/dev-console/apps-register",
    label: "Register App",
    icon: "📝",
    description: "Create developer organization and sandbox app records (no API keys yet).",
  },
  {
    path: "/dev-console/my-apps",
    label: "My Apps",
    icon: "📦",
    description: "Your organizations, app statuses, governance reviews, and lifecycle history.",
  },
  {
    path: "/dev-console/app-governance",
    label: "App Governance",
    icon: "🛡️",
    adminOnly: true,
    description: "Admin review queue for sandbox activation and environment upgrades (metadata only).",
  },
  {
    path: "/dev-console/credential-architecture",
    label: "Credential Architecture",
    icon: "🔐",
    description:
      "Phase 5A credential metadata, lifecycle vocabulary, vault blueprint, and signing concepts (configuration only — no issuance).",
  },
  {
    path: "/dev-console/auth-simulator",
    label: "Auth Simulator",
    icon: "🛂",
    description:
      "Phase 5B authentication flow modeling and request verification simulation — static stages, policies, and outcomes only (no real auth or APIs).",
  },
  {
    path: "/dev-console/gateway-simulator",
    label: "Gateway Simulator",
    icon: "🚦",
    description:
      "Phase 5C request envelope choreography simulation — fourteen static gateway surfaces, delegated Phase 5B traces, illustrative routing previews; modeling only.",
  },
  {
    path: "/dev-console/execution-routing",
    label: "Execution Routing",
    icon: "🧭",
    description:
      "Phase 5D execution routing & service orchestration simulation — twelve post-gateway stages, ten sandbox delegate targets, merges across Phase 5C/5B/4D/3A/3B seeds; choreography only.",
  },
  {
    path: "/dev-console/app-capabilities",
    label: "App Capabilities",
    icon: "🧬",
    description:
      "Sandbox capability assignments, access policies, and capability requests (governance metadata only).",
  },
  {
    path: "/dev-console/product-catalog",
    label: "Product Catalog",
    icon: "📚",
    description:
      "Phase 4D static API product catalog and sandbox runtime contract previews (configuration only — no HTTP surface).",
  },
  {
    path: "/dev-console/sandbox-analytics",
    label: "Sandbox Analytics",
    icon: "📈",
    description:
      "Phase 4E sandbox usage simulation and developer analytics previews (static seeds only — no telemetry or quotas).",
  },
  {
    path: "/dev-console/api-keys",
    label: "API Keys",
    icon: "🔑",
    description: "Manage sandbox and live API keys (not yet active).",
  },
  {
    path: "/dev-console/webhooks",
    label: "Webhooks",
    icon: "🔔",
    description: "Subscribe to platform events and verify deliveries.",
  },
  {
    path: "/dev-console/logs",
    label: "Logs",
    icon: "📋",
    description: "Per-request logs and audit trail.",
  },
  {
    path: "/dev-console/sandbox",
    label: "Sandbox",
    icon: "🧪",
    description: "Sandbox-only resources isolated from live wallets.",
  },
  {
    path: "/dev-console/settings",
    label: "Settings",
    icon: "⚙️",
    description: "Account, team, and billing settings (planned).",
  },
  {
    path: "/dev-console/internal-blueprint",
    label: "Internal Blueprint",
    icon: "🗺️",
    description:
      "Planning-only summary of internal service namespaces, events, and Blue Atlantic integrations.",
  },
  {
    path: "/dev-console/internal-services",
    label: "Internal Services",
    icon: "🧩",
    description:
      "Phase 2A registry of planned Triton, Sentinel, and EliteHire Pro service identities with permissions and risk levels.",
  },
  {
    path: "/dev-console/internal-governance",
    label: "Governance",
    icon: "🛡️",
    description:
      "Phase 2B governance layer: lifecycle reviews, runtime policies, and environment gates for internal Blue Atlantic integrations.",
  },
  {
    path: "/dev-console/capabilities",
    label: "Capabilities",
    icon: "⚙️",
    description:
      "Phase 2C capability registry: reusable capability definitions, dependency relationships, and per-environment operational constraints.",
  },
  {
    path: "/dev-console/orchestration",
    label: "Orchestration",
    icon: "🧠",
    description:
      "Phase 2D execution orchestration blueprint: pipeline stages, policy evaluation rules, runtime decisions, and per-capability trace templates.",
  },
  {
    path: "/dev-console/observability",
    label: "Observability",
    icon: "📡",
    description:
      "Phase 2E observability & runtime telemetry blueprint: execution sessions, metric catalog, failure taxonomy, replay templates, and planned dashboards.",
  },
  {
    path: "/dev-console/runtime-state",
    label: "Runtime State",
    icon: "🧾",
    description:
      "Phase 2F runtime state & event store blueprint: append-only event store, derived snapshots, per-trace checkpoints, and cross-service correlation links.",
  },
  {
    path: "/dev-console/execution-simulator",
    label: "Execution Simulator",
    icon: "🧪",
    description:
      "Phase 3A execution simulator: deterministic, replayable scenarios that visualize how a future request would walk the pipeline. Simulation only — no runtime, no money movement.",
  },
  {
    path: "/dev-console/decision-simulator",
    label: "Decision Simulator",
    icon: "⚖️",
    description:
      "Phase 3B decision simulator: deterministic rule walks that explain why a simulated execution is allowed, blocked, delayed, rate-limited, or sent to review. Simulation only — no policy enforcement.",
  },
  {
    path: "/dev-console/simulation-history",
    label: "Simulation History",
    icon: "📊",
    description:
      "Phase 3C simulation run history: deterministic ledger, outcome distributions, and scenario-vs-decision comparison. Simulation only — no persistence.",
  },
  {
    path: "/dev-console/policy-graphs",
    label: "Policy Graphs",
    icon: "🕸️",
    description:
      "Phase 3D runtime policy visualization: static dependency and policy gate graphs from capabilities, decision rules, and simulation history. Visualization only — no enforcement.",
  },
  {
    path: "/dev-console/runtime-activation",
    label: "Runtime Activation",
    icon: "🔒",
    description:
      "Phase 6A runtime activation governance and environment isolation blueprint: activation states, gates, kill switches, safety envelopes, and emergency shutdown modeling — no live runtime.",
  },
];

/**
 * Placeholder platform status values. The status page renders all services
 * as `development` for now — no live monitoring is wired up.
 */
export const PLATFORM_STATUS = {
  development: {
    key: "development",
    label: "Development Phase",
    tone: "info",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  operational: {
    key: "operational",
    label: "Operational",
    tone: "ok",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  degraded: {
    key: "degraded",
    label: "Degraded",
    tone: "warn",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  outage: {
    key: "outage",
    label: "Outage",
    tone: "error",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
};

/**
 * Platform components surfaced on /developers/status. All start in
 * `development` for Phase 1.5.
 */
export const PLATFORM_STATUS_COMPONENTS = [
  { key: "api_platform", label: "API Platform", statusKey: "development" },
  { key: "sandbox", label: "Sandbox Environment", statusKey: "development" },
  { key: "wallet_services", label: "Wallet Services", statusKey: "development" },
  { key: "payout_services", label: "Payout Services", statusKey: "development" },
  { key: "webhooks", label: "Webhooks", statusKey: "development" },
  { key: "developer_console", label: "Developer Console", statusKey: "development" },
];

/**
 * High-level developer platform phases. Mirrors `/developers/roadmap` but in a
 * compact, machine-readable form so multiple pages can reference the same
 * phase metadata without drifting.
 */
export const DEVELOPER_PLATFORM_PHASES = [
  {
    key: "phase_1",
    label: "Phase 1",
    title: "Developer Center foundation",
    status: "in_progress",
  },
  {
    key: "phase_2",
    label: "Phase 2",
    title: "Developer accounts & API keys",
    status: "planned",
  },
  {
    key: "phase_3",
    label: "Phase 3",
    title: "Core money-movement APIs",
    status: "planned",
  },
  {
    key: "phase_4",
    label: "Phase 4",
    title: "Blue Atlantic integrations",
    status: "planned",
  },
  {
    key: "phase_5",
    label: "Phase 5",
    title: "External developers & merchants",
    status: "planned",
  },
];

/**
 * Dev Console nav entries may set `adminOnly: true` (e.g. app governance queue).
 * Non-admins should not see those links; the route itself still enforces access.
 */
export function filterDevConsoleRoutes(routes, { isAdmin = false } = {}) {
  return routes.filter((route) => !route.adminOnly || isAdmin);
}

/**
 * Helper: given a phase key, return its human label. Pages reuse this so the
 * "Coming in Phase X" badges stay consistent across docs / pricing / status.
 */
export function getPhaseLabel(phaseKey) {
  const found = DEVELOPER_PLATFORM_PHASES.find((p) => p.key === phaseKey);
  return found?.label ?? "Phase ?";
}
