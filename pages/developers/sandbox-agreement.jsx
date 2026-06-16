import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import { useUser } from "../../lib/userContext";
import { evaluateDeveloperSandboxAccess } from "../../lib/developerSandboxAccessPolicy";
import {
  acceptSandboxAgreement,
  CURRENT_SANDBOX_AGREEMENT_VERSION,
  fetchOwnSandboxAgreements,
  SANDBOX_AGREEMENT_SECTIONS,
} from "../../lib/developerSandboxAgreements";

const cardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

async function resolveClientIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.ip === "string" ? json.ip : null;
  } catch {
    return null;
  }
}

export default function DeveloperSandboxAgreementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [accessEval, setAccessEval] = useState(null);
  const [ownAgreements, setOwnAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [acceptedRecord, setAcceptedRecord] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setAccessEval(null);
      setOwnAgreements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [access, agreements] = await Promise.all([
      evaluateDeveloperSandboxAccess(userId),
      fetchOwnSandboxAgreements(),
    ]);
    setAccessEval(access);
    setOwnAgreements(Array.isArray(agreements.data) ? agreements.data : []);
    const current = (agreements.data || []).find(
      (row) => row.agreement_version === CURRENT_SANDBOX_AGREEMENT_VERSION,
    );
    setAcceptedRecord(current || null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/developers/sandbox-agreement")}`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  async function handleAccept(e) {
    e.preventDefault();
    setFormError("");
    if (!userId) return;
    if (!acknowledged) {
      setFormError("You must acknowledge all terms before accepting.");
      return;
    }
    if (!accessEval?.approved) {
      setFormError("Your sandbox application must be approved before accepting the agreement.");
      return;
    }
    if (acceptedRecord || accessEval?.agreementAccepted) {
      setFormError("You have already accepted this agreement version.");
      return;
    }

    setSubmitting(true);
    const accepted_ip = await resolveClientIp();
    const { data, error } = await acceptSandboxAgreement({
      user_id: userId,
      agreement_version: CURRENT_SANDBOX_AGREEMENT_VERSION,
      accepted_ip,
      accepted_user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null,
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message || "Could not record agreement acceptance.");
      return;
    }

    setAcceptedRecord(data);
    setAcknowledged(false);
    void load();
  }

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-slate-600">Loading…</p>
        </main>
      </>
    );
  }

  const alreadyAccepted = Boolean(acceptedRecord || accessEval?.agreementAccepted);
  const notApproved = accessEval && !accessEval.approved;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4 text-sm">
          <Link href="/developers/get-started" className="font-semibold text-tropicash-green-hover underline">
            ← Developer onboarding
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Tropicash Sandbox Agreement</h1>
        <p className="mt-2 text-sm text-slate-600">
          Version <strong>{CURRENT_SANDBOX_AGREEMENT_VERSION}</strong> — acceptance is required
          before creating sandbox API credentials or OAuth clients.
        </p>

        {notApproved ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            Your sandbox application must be approved before you can accept this agreement.{" "}
            <Link href="/developers/apply" className="font-semibold underline">
              View application status
            </Link>
          </div>
        ) : null}

        {alreadyAccepted ? (
          <div
            role="status"
            className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            <p className="font-semibold">✓ Agreement accepted</p>
            <p className="mt-1">
              Version {accessEval?.agreementVersion || CURRENT_SANDBOX_AGREEMENT_VERSION} accepted{" "}
              {formatWhen(accessEval?.agreementAcceptedAt || acceptedRecord?.accepted_at)}.
            </p>
            <p className="mt-2 text-xs opacity-80">
              Duplicate acceptance of the same version is not permitted.
            </p>
          </div>
        ) : null}

        <section className={`${cardClass} mt-6`} aria-labelledby="agreement-content-heading">
          <h2 id="agreement-content-heading" className="text-lg font-bold text-slate-900">
            Required acknowledgements
          </h2>
          <div className="mt-4 space-y-5">
            {SANDBOX_AGREEMENT_SECTIONS.map((section) => (
              <div key={section.id}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                  {section.title}
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {!alreadyAccepted && accessEval?.approved ? (
          <form onSubmit={handleAccept} className={`${cardClass} mt-6`}>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                I have read and accept the Tropicash Sandbox Agreement ({CURRENT_SANDBOX_AGREEMENT_VERSION}).
                I understand this grants sandbox testing access only — no production access or money movement.
              </span>
            </label>

            {formError ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !acknowledged}
              className="mt-4 rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tropicash-green-hover disabled:opacity-60"
            >
              {submitting ? "Recording acceptance…" : "Accept Sandbox Agreement"}
            </button>
          </form>
        ) : null}

        {ownAgreements.length ? (
          <section className={`${cardClass} mt-6`} aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-lg font-bold text-slate-900">
              Your acceptance history
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {ownAgreements.map((row) => (
                <li key={row.id}>
                  {row.agreement_version} — {formatWhen(row.accepted_at)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-6 text-sm text-slate-600">
          <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
            API Credentials
          </Link>
          {" · "}
          <Link href="/dev-console/oauth-clients" className="font-semibold text-tropicash-green-hover underline">
            OAuth Clients
          </Link>
        </p>
      </main>
    </>
  );
}
