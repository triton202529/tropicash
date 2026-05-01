import { supabase } from "./supabaseClient";

const LIMITS = {
  send: { max: 500, min: 1 },
  withdraw: { max: 500, min: 1 },
  fund: { max: 1000, min: 1 },
};

function normalizeAccountStatus(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** reviewed = cleared; open / escalated / unknown = still active for risk gating */
function fraudLogIsOpen(row) {
  const v = String(row?.status || "").toLowerCase();
  return v !== "reviewed";
}

/**
 * Lightweight client-side trust checks (limits, account state, recent fraud_logs).
 * Does not replace server validation.
 *
 * @param {{
 *   userId: string,
 *   transactionType: "send" | "fund" | "withdraw",
 *   amount: number,
 *   profile: unknown,
 * }} params
 * @returns {Promise<{ allowed: boolean, severity: "none" | "warning" | "blocked", message: string, reasonCode: string }>}
 */
export async function evaluateTrustCheck({ userId, transactionType, amount, profile }) {
  const type = String(transactionType || "").toLowerCase();
  const amt = Number(amount);

  if (!userId) {
    return {
      allowed: false,
      severity: "blocked",
      message: "Please sign in again.",
      reasonCode: "no_user",
    };
  }

  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      allowed: false,
      severity: "blocked",
      message: "Please enter a valid amount.",
      reasonCode: "invalid_amount",
    };
  }

  const lim = LIMITS[type];
  if (!lim) {
    return {
      allowed: false,
      severity: "blocked",
      message: "Unsupported transaction type.",
      reasonCode: "bad_type",
    };
  }

  if (amt < lim.min) {
    return {
      allowed: false,
      severity: "blocked",
      message: "This amount is below the minimum allowed for this action.",
      reasonCode: "below_min",
    };
  }

  if (amt > lim.max) {
    if (type === "send") {
      return {
        allowed: false,
        severity: "blocked",
        message: "This amount exceeds the current send limit.",
        reasonCode: "over_max_send",
      };
    }
    if (type === "withdraw") {
      return {
        allowed: false,
        severity: "blocked",
        message: "This amount exceeds the current withdraw limit.",
        reasonCode: "over_max_withdraw",
      };
    }
    return {
      allowed: false,
      severity: "blocked",
      message: "This amount exceeds the current fund limit.",
      reasonCode: "over_max_fund",
    };
  }

  const acct = normalizeAccountStatus(profile?.account_status);
  if (acct === "restricted" || acct === "suspended" || acct === "blocked") {
    return {
      allowed: false,
      severity: "blocked",
      message: "Your account is temporarily restricted.",
      reasonCode: "account_restricted",
    };
  }

  let mediumOpen = false;
  try {
    const { data: logs, error } = await supabase
      .from("fraud_logs")
      .select("risk_level, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.warn("[trustLayer] fraud_logs:", error.message || error);
    } else {
      for (const row of logs || []) {
        const rl = String(row?.risk_level || "").toLowerCase();
        const open = fraudLogIsOpen(row);
        if (rl === "high" && open) {
          return {
            allowed: false,
            severity: "blocked",
            message: "This transaction is under review due to recent risk activity.",
            reasonCode: "fraud_high_open",
          };
        }
        if (rl === "medium" && open) {
          mediumOpen = true;
        }
      }
    }
  } catch (e) {
    console.warn("[trustLayer] fraud_logs fetch threw:", e);
  }

  if (mediumOpen) {
    return {
      allowed: true,
      severity: "warning",
      message:
        "Recent activity on your account may be subject to additional review. You can still continue.",
      reasonCode: "fraud_medium_open",
    };
  }

  return {
    allowed: true,
    severity: "none",
    message: "",
    reasonCode: "",
  };
}
