import LegalDocumentLayout from "../../components/legal/LegalDocumentLayout";

const related = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/kyc-policy", label: "KYC Policy" },
  { href: "/legal/aml-policy", label: "AML Policy" },
];

export default function LegalPrivacyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" relatedLinks={related}>
      <p>
        This draft privacy policy explains how Tropicash handles information during operational testing. It is not a
        final privacy notice and will be replaced after legal review.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Data we collect</h2>
        <p>
          We collect account and profile information (such as name, email, phone), authentication identifiers, wallet
          and transaction records, device/session signals, support communications, and operational logs needed to run
          the platform securely.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">KYC documents</h2>
        <p>
          When you submit identity verification, you may upload documents (for example government ID). Documents are
          stored in private storage accessible only through controlled application and admin review flows. Document
          file paths and raw storage URLs are not exposed in the user interface.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Transaction records</h2>
        <p>
          We retain records of funding, sends, withdrawals, and related metadata (amounts, timestamps, statuses,
          payout destinations) to provide history, reconciliation, fraud prevention, and customer support.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Security &amp; fraud logs</h2>
        <p>
          We generate security events, fraud signals, audit entries, and rate-limit records to protect users and the
          platform. These logs may include IP-derived signals, account actions, and admin review notes.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Storage &amp; retention</h2>
        <p>
          Data is stored using Supabase and related infrastructure configured for the Tropicash environment. Retention
          periods for testing are not final; production retention schedules will be defined before public launch.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Third-party processors</h2>
        <p>
          Payment funding and payouts may involve third-party providers (for example PayPal). Those providers process
          data under their own policies when you interact with their flows.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Your rights (placeholder)</h2>
        <p>
          Depending on your jurisdiction, you may have rights to access, correct, or delete personal data. During testing,
          contact Support to submit requests. Formal data-subject procedures will be published before public launch.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Marketing</h2>
        <p>We do not sell your personal data to third parties for their marketing purposes.</p>
      </section>
    </LegalDocumentLayout>
  );
}
