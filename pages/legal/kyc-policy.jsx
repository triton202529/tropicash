import LegalDocumentLayout from "../../components/legal/LegalDocumentLayout";

const related = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/aml-policy", label: "AML Policy" },
];

export default function LegalKycPolicyPage() {
  return (
    <LegalDocumentLayout title="KYC Policy" relatedLinks={related}>
      <p>
        This draft Know Your Customer (KYC) policy describes how Tropicash collects and reviews identity information
        during operational testing. It does not describe a fully automated vendor program.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Identity verification</h2>
        <p>
          Users may be asked to verify identity before higher limits apply or before certain withdrawals are settled.
          Verification typically includes personal details and document uploads reviewed by authorized administrators.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Document uploads</h2>
        <p>
          You may upload identity documents through the in-app KYC flow. Documents are stored privately and used only
          for verification and compliance review. Do not share document storage links externally.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Review statuses</h2>
        <p>
          KYC submissions may be marked not started, submitted, under review, approved, rejected, or needs more info.
          Status changes may be recorded in an append-only review audit trail for admin accountability.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Limits &amp; enforcement</h2>
        <p>
          Verification tier affects recommended daily limits for funding, sending, and withdrawals. Withdrawals may be
          enforced against policy limits on the client and server; funding and send limits are advisory previews during
          testing unless a future phase activates enforcement.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Resubmission</h2>
        <p>
          If your verification is rejected or needs more information, you may be able to update and resubmit depending
          on your current status. Follow in-app prompts and admin notes.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Admin review</h2>
        <p>
          Authorized admins review KYC submissions through internal tools. Rejections and requests for more information
          should include notes explaining what is required.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
