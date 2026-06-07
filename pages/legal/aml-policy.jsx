import LegalDocumentLayout from "../../components/legal/LegalDocumentLayout";

const related = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/kyc-policy", label: "KYC Policy" },
  { href: "/legal/risk-disclosure", label: "Risk Disclosure" },
];

export default function LegalAmlPolicyPage() {
  return (
    <LegalDocumentLayout title="AML Policy" relatedLinks={related}>
      <p>
        This draft Anti-Money Laundering (AML) policy outlines how Tropicash approaches suspicious activity monitoring
        during operational testing. It is a placeholder pending formal AML program design and legal review.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Monitoring</h2>
        <p>
          Tropicash uses rule-based fraud scoring, transaction metadata, velocity signals, and admin review queues to
          identify unusual activity. Automated decisions may flag activity for human review rather than immediate
          account action.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Transaction reviews</h2>
        <p>
          Funding, sends, and withdrawals may be reviewed manually or delayed when risk signals exceed thresholds.
          Admins may access fraud logs, risk user summaries, and treasury event context to investigate patterns.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Reporting readiness</h2>
        <p>
          Operational testing includes audit trails and admin logging to support future regulatory reporting workflows.
          Formal suspicious activity report (SAR) or equivalent filing processes are not yet implemented in product.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Sanctions screening (placeholder)</h2>
        <p>
          Production launch may require sanctions and politically exposed persons (PEP) screening integrated with a
          compliance vendor. Tropicash does not currently represent that automated sanctions screening is live in the
          testing environment.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Recordkeeping</h2>
        <p>
          Transaction, fraud, security, and admin audit records may be retained to support investigations. Retention
          schedules for production will be finalized with legal and compliance advisors.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Cooperation</h2>
        <p>
          We may cooperate with law enforcement and regulators when legally required. Users must not use Tropicash to
          evade sanctions, conceal illicit funds, or structure transactions to avoid detection.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
