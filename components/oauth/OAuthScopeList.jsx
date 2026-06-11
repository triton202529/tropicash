/**
 * Phase 12M — renders the requested OAuth scopes as review cards.
 *
 * Each card shows the scope label, the raw scope name, a risk badge, the
 * user-facing description, and which controls the scope requires (user consent,
 * admin approval, step-up auth). Unknown scopes render as an explicit invalid
 * card. No secrets are ever displayed.
 */

const RISK_BADGE = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-orange-200 bg-orange-50 text-orange-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};

function RiskBadge({ level }) {
  const key = String(level || "").toLowerCase();
  const cls = RISK_BADGE[key] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}
    >
      {key || "unknown"} risk
    </span>
  );
}

function RequirementPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function KnownScopeCard({ definition }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{definition.label}</p>
          <code className="text-xs text-slate-500">{definition.scope}</code>
        </div>
        <RiskBadge level={definition.riskLevel} />
      </div>
      <p className="mt-2 text-sm text-slate-700">{definition.userFacingDescription}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {definition.requiresUserConsent ? (
          <RequirementPill>Requires your consent</RequirementPill>
        ) : null}
        {definition.requiresAdminApproval ? (
          <RequirementPill>Requires admin approval</RequirementPill>
        ) : null}
        {definition.requiresStepUpAuth ? (
          <RequirementPill>Requires step-up verification</RequirementPill>
        ) : null}
      </div>
    </li>
  );
}

function UnknownScopeCard({ scope }) {
  return (
    <li className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-red-900">Unknown permission</p>
          <code className="text-xs text-red-700">{scope || "—"}</code>
        </div>
        <span className="inline-block rounded-full border border-red-300 bg-white px-2 py-0.5 text-xs font-semibold text-red-800">
          Unrecognized
        </span>
      </div>
      <p className="mt-2 text-sm text-red-800">
        This permission is not part of the Tropicash scope catalog. The request cannot be approved.
      </p>
    </li>
  );
}

export default function OAuthScopeList({ items = [] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-600">This request did not specify any permissions.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) =>
        item.known && item.definition ? (
          <KnownScopeCard key={item.scope} definition={item.definition} />
        ) : (
          <UnknownScopeCard key={item.scope} scope={item.scope} />
        ),
      )}
    </ul>
  );
}
