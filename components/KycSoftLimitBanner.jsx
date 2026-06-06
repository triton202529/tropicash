import Link from "next/link";
import { useEffect, useState } from "react";
import { buildKycRiskProfile, getKycSoftLimitBannerContent } from "../lib/kycRisk";

const toneStyles = {
  success: {
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
    linkColor: "#065f46",
  },
  info: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    linkColor: "#1e40af",
  },
  warning: {
    border: "1px solid #fcd34d",
    background: "#fffbeb",
    color: "#92400e",
    linkColor: "#b45309",
  },
  danger: {
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#991b1b",
    linkColor: "#b91c1c",
  },
};

/**
 * Non-blocking KYC soft-limit guidance banner. Does not gate wallet actions.
 */
export default function KycSoftLimitBanner({ userId }) {
  const [kycStatus, setKycStatus] = useState(null);

  useEffect(() => {
    if (!userId) {
      setKycStatus("not_started");
      return;
    }
    let cancelled = false;
    void buildKycRiskProfile(userId).then(({ data }) => {
      if (!cancelled) {
        setKycStatus(data?.kycStatus || "not_started");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (kycStatus == null) return null;

  const { tone, message, showLink } = getKycSoftLimitBannerContent(kycStatus);
  const styles = toneStyles[tone] || toneStyles.info;

  return (
    <div
      role="status"
      style={{
        marginBottom: "1rem",
        padding: "0.85rem 1rem",
        borderRadius: "12px",
        border: styles.border,
        background: styles.background,
        fontSize: "0.86rem",
        lineHeight: 1.5,
      }}
    >
      <p style={{ margin: 0, color: styles.color }}>
        {message}{" "}
        {showLink ? (
          <Link href="/kyc" style={{ fontWeight: 700, color: styles.linkColor, textDecoration: "underline" }}>
            Verify identity
          </Link>
        ) : null}
      </p>
    </div>
  );
}
