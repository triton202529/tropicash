import Link from "next/link";
import { formatFinancialBlockUserMessage } from "../lib/accountSecurityStatus";

const boxStyle = {
  padding: "0.75rem 0.9rem",
  marginBottom: "1rem",
  borderRadius: "10px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#78350f",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

/**
 * @param {{ gate?: { allowed?: boolean; reason?: string | null; message?: string } | null; message?: string; style?: object }} props
 */
export default function FinancialRestrictionNotice({ gate, message, style }) {
  if (gate?.allowed !== false && !message) return null;
  const text = message || formatFinancialBlockUserMessage(gate || {});
  return (
    <div role="alert" style={{ ...boxStyle, ...style }}>
      <p style={{ margin: 0 }}>{text}</p>
      <p style={{ margin: "0.45rem 0 0", fontSize: "0.8rem" }}>
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
