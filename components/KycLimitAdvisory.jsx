import { useEffect, useState } from "react";
import { evaluateKycTransactionLimit } from "../lib/kycRisk";

function formatLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Advisory-only KYC limit preview. Does not block wallet actions.
 */
export default function KycLimitAdvisory({ userId, actionType, amount }) {
  const [evaluation, setEvaluation] = useState(null);

  useEffect(() => {
    const amt = Number(amount);
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      setEvaluation(null);
      return;
    }
    let cancelled = false;
    void evaluateKycTransactionLimit({ userId, actionType, amount: amt }).then((result) => {
      if (!cancelled) setEvaluation(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, actionType, amount]);

  if (!evaluation || evaluation.limit == null) return null;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", lineHeight: 1.45 }}>
        Your current recommended daily limit is ${formatLimit(evaluation.limit)}.
      </p>
      {evaluation.exceedsLimit ? (
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#92400e", lineHeight: 1.45 }}>
          This amount is above your current recommended KYC limit. It is not blocked yet, but may require verification
          in future.
        </p>
      ) : null}
    </div>
  );
}
