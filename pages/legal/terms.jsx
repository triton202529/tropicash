import LegalDocumentLayout from "../../components/legal/LegalDocumentLayout";

const related = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/risk-disclosure", label: "Risk Disclosure" },
  { href: "/legal/kyc-policy", label: "KYC Policy" },
];

export default function LegalTermsPage() {
  return (
    <LegalDocumentLayout title="Terms of Service" relatedLinks={related}>
      <p>
        These draft terms describe how you may use Tropicash during operational testing. Tropicash provides a digital
        wallet for funding, sending money to other users, and requesting withdrawals to external payout destinations.
        By using the service, you agree to these placeholder terms until counsel-approved documents replace them.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Wallet usage</h2>
        <p>
          Your wallet balance reflects completed credits and debits recorded by Tropicash. Balances shown in the app are
          informational and subject to verification, fraud review, and operational processing. You must maintain
          accurate profile, contact, and payout information.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Funding</h2>
        <p>
          Wallet funding may be processed through third-party payment providers (for example PayPal). Funding is subject
          to provider rules, daily limits, identity verification status, and fraud checks. Failed or reversed funding
          attempts may not credit your wallet.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Sending money</h2>
        <p>
          Peer-to-peer sends debit your wallet and credit the recipient when successfully processed. Sends are generally
          final once completed. You may not use Tropicash to send funds to yourself or for unlawful purposes. Send limits
          may apply based on verification tier and operational policy.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Withdrawals</h2>
        <p>
          Withdrawal requests move funds from your wallet toward an external payout method you provide. Withdrawals may
          require identity verification, manual admin review, and compliance checks before settlement. Tropicash may
          delay, reject, or reverse withdrawals when required by policy, fraud signals, or insufficient verification.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Account suspension &amp; restrictions</h2>
        <p>
          We may restrict, suspend, or terminate access when we detect suspicious activity, policy violations, security
          concerns, or incomplete verification. Restricted accounts may be unable to fund, send, or withdraw until
          review is complete.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Prohibited activity</h2>
        <p>
          You may not use Tropicash for fraud, money laundering, sanctions evasion, harassment, unauthorized access, or
          any illegal activity. We may report suspicious activity to appropriate authorities when required or permitted
          by law.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Changes</h2>
        <p>
          These draft terms may change during testing. Continued use after updates constitutes acceptance of the revised
          draft until final legal documents are published.
        </p>
      </section>
    </LegalDocumentLayout>
  );
}
