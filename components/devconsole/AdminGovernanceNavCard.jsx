import Link from "next/link";
import { isAdminUser } from "../../lib/adminAccess";
import { useUser } from "../../lib/userContext";

/**
 * Admin-only callout linking to the developer app governance review queue.
 */
export default function AdminGovernanceNavCard() {
  const { user, profile, loading } = useUser();

  if (loading || !isAdminUser(user, profile)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
      <p className="font-semibold text-violet-900">Developer Governance</p>
      <p className="mt-1 text-violet-900/90">
        Review pending sandbox activations, live upgrades, and capability requests in the
        governance queue.
      </p>
      <Link
        href="/dev-console/app-governance"
        className="mt-3 inline-flex rounded-lg bg-violet-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-800"
      >
        Open Developer Governance →
      </Link>
    </div>
  );
}
