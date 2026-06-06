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
  const action = String(actionType || "").toLowerCase();
  const isWithdrawal = action === "withdrawal";

  useEffect(() => {
    const amt = Number(amount);
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      setEvaluation(null);
      return;
    }
    let cancelled = false;
    void evaluateKycTransactionLimit({ userId, actionType: action, amount: amt }).then((result) => {
      if (!cancelled) setEvaluation(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, action, amount]);

  if (!evaluation || evaluation.limit == null) return null;

  if (isWithdrawal) {
    const usedToday = Number(evaluation.usedToday) || 0;
    const remainingToday =
      evaluation.remainingToday != null ? Number(evaluation.remainingToday) : null;
    const projectedTotal = Number(evaluation.projectedTotal) || usedToday + (Number(amount) || 0);

    return (
      <div
        style={{
          marginTop: "0.65rem",
          padding: "0.65rem 0.75rem",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Daily withdrawal limit
        </p>
        <div style={{ marginTop: "0.45rem", display: "grid", gap: "0.25rem", fontSize: "0.82rem", color: "#334155", lineHeight: 1.45 }}>
          <span>Limit: ${formatLimit(evaluation.limit)}</span>
          <span>Used today: ${formatLimit(usedToday)}</span>
          <span>Remaining today: ${remainingToday != null ? formatLimit(remainingToday) : "—"}</span>
          <span>Projected total after this request: ${formatLimit(projectedTotal)}</span>
        </div>
        {evaluation.exceedsLimit ? (
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "#92400e", lineHeight: 1.45 }}>
            {evaluation.advisoryOnly
              ? "This request would exceed your daily limit. Withdrawals are not blocked while enforcement is advisory."
              : "This request would exceed your daily limit and will be blocked."}
          </p>
        ) : null}
      </div>
    );
  }

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
