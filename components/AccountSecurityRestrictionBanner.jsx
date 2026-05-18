import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../lib/userContext";
import { getAccountSecurityStatus, isAccountFrozenOrRestricted } from "../lib/accountSecurityStatus";

const bannerStyle = {
  background: "linear-gradient(180deg, #fffbeb 0%, #fff7ed 100%)",
  borderBottom: "1px solid #fde68a",
  padding: "0.65rem 1rem",
  color: "#78350f",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

export default function AccountSecurityRestrictionBanner() {
  const { user, loading } = useUser();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !user?.id) {
      setShow(false);
      setChecked(!loading && !user?.id);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await getAccountSecurityStatus(user.id);
        if (cancelled) return;
        setShow(isAccountFrozenOrRestricted(row));
      } catch {
        if (!cancelled) setShow(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  if (!checked || !show) return null;

  return (
    <div role="status" style={bannerStyle}>
      <p style={{ margin: 0, maxWidth: "52rem", marginLeft: "auto", marginRight: "auto" }}>
        Your Tropicash account has a security restriction. Some actions may be limited while we review your account.{" "}
        <Link href="/security" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>
          Security Center
        </Link>
        {" · "}
        <Link href="/support" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>
          Support
        </Link>
      </p>
    </div>
  );
}
