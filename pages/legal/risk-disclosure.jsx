import LegalDocumentLayout from "../../components/legal/LegalDocumentLayout";

const related = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/aml-policy", label: "AML Policy" },
  { href: "/legal/privacy", label: "Privacy Policy" },
];

export default function LegalRiskDisclosurePage() {
  return (
    <LegalDocumentLayout title="Risk Disclosure" relatedLinks={related}>
      <p>
        Tropicash involves financial and technology risks. This draft disclosure highlights key risks during operational
        testing. It is not investment advice and does not guarantee outcomes.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Wallet &amp; payment risks</h2>
        <p>
          Digital wallet balances depend on successful processing of funding, transfers, and withdrawals. Errors,
          disputes, fraud, or provider failures could affect balances, timing, or availability of funds shown in the app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Delays &amp; manual review</h2>
        <p>
          Withdrawals and high-risk activity may require manual admin review. Payouts can be delayed during testing even
          when a request appears pending or processing in the app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Third-party payment providers</h2>
        <p>
          Funding and external payouts may rely on third parties such as PayPal. Their availability, fees, limits, and
          dispute processes are outside Tropicash direct control. Provider outages may block funding or payouts temporarily.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Account restrictions</h2>
        <p>
          Accounts may be restricted for security, fraud, incomplete KYC, or policy violations. Restricted users may be
          unable to fund, send, or withdraw until issues are resolved.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Identity verification limits</h2>
        <p>
          Transaction limits may depend on verification status. Unverified or partially verified users may face lower
          recommended limits; withdrawals may be blocked when enforcement policies apply.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">System availability</h2>
        <p>
          Tropicash is in controlled testing. Features, limits, and uptime may change without notice. Maintenance,
          deployments, or incidents may interrupt access to the app or specific money movement flows.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">No guarantee</h2>
        <p>
          Tropicash does not guarantee uninterrupted service, error-free processing, or specific payout timelines during
          testing. Use the service only with funds you can afford to have temporarily unavailable while reviews complete.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
