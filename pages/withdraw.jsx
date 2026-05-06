import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Legacy route: wallet and older links may still point to /withdraw.
 * Real withdrawal flow lives at /withdraw-wallet.
 */
export default function WithdrawRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/withdraw-wallet");
  }, [router]);

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "480px",
        margin: "0 auto",
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "transparent",
      }}
    >
      <p style={{ color: "#64748b" }}>Redirecting to withdrawal…</p>
    </div>
  );
}
