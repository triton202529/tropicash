import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

export default function TransactionsPage() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchData() {
      setLoading(true);

      console.log("Logged-in user ID:", user?.id);

      // Fetch all related transactions
      const { data: txns, error: txnError } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (txnError) {
        console.error("Transaction fetch error:", txnError.message);
        setLoading(false);
        return;
      }

      console.log("Fetched transactions:", txns);

      setTransactions(txns);

      // Get unique user IDs involved
      const userIds = [
        ...new Set(txns.flatMap((txn) => [txn.sender_id, txn.recipient_id])),
      ].filter(Boolean);

      // Fetch all involved profiles
      const { data: usersData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profileError) {
        console.error("Profile fetch error:", profileError.message);
        setLoading(false);
        return;
      }

      const profileMap = {};
      usersData.forEach((p) => {
        profileMap[p.id] = p.full_name;
      });
      setProfiles(profileMap);

      setLoading(false);
    }

    fetchData();
  }, [user?.id]);

  const formatDate = (iso) => new Date(iso).toLocaleString();

  const formatTxn = (txn) => {
    const from = profiles[txn.sender_id] || "System";
    const to = profiles[txn.recipient_id] || "Unknown";

    const isIncoming = txn.recipient_id === user.id;
    const isOutgoing = txn.sender_id === user.id;

    let direction = "";
    let amountSign = "";
    let color = "";

    if (txn.type === "fund") {
      direction = "Wallet Funded";
      amountSign = "+";
      color = "text-green-600";
    } else if (isOutgoing) {
      direction = `Sent to ${to}`;
      amountSign = "-";
      color = "text-red-600";
    } else if (isIncoming) {
      direction = `Received from ${from}`;
      amountSign = "+";
      color = "text-green-600";
    }

    return {
      label: direction,
      amount: `${amountSign}$${Number(txn.amount).toFixed(2)}`,
      color,
      date: formatDate(txn.created_at),
    };
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>

      {loading ? (
        <p>Loading...</p>
      ) : transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <ul className="space-y-4">
          {transactions.map((txn) => {
            const { label, amount, color, date } = formatTxn(txn);
            return (
              <li key={txn.id} className="border rounded p-4 shadow-sm">
                <p className="font-medium">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{amount}</p>
                <p className="text-sm text-gray-500">{date}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
