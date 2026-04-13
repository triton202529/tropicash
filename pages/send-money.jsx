import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

export default function SendMoneyPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
      fetchBalance();
      fetchRecipients();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
    } else {
      setProfile(data);
    }
  };

  const fetchBalance = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("status", "completed");

    if (error) {
      console.error("Balance fetch error:", error);
      return;
    }

    let total = 0;
    data.forEach((tx) => {
      if (tx.type === "fund" && tx.sender_id === user.id) {
        total += tx.amount;
      } else if (tx.type === "send") {
        if (tx.sender_id === user.id) {
          total -= tx.amount;
        } else if (tx.recipient_id === user.id) {
          total += tx.amount;
        }
      }
    });

    setBalance(total);
  };

  const fetchRecipients = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .neq("id", user.id);

    if (error) {
      console.error("Error fetching recipients:", error);
    } else {
      setRecipients(data);
    }
  };

  const handleSend = async () => {
    if (!recipientId || !amount || isNaN(amount) || Number(amount) <= 0) {
      alert("Please enter a valid amount and recipient.");
      return;
    }

    if (Number(amount) > balance) {
      alert("Insufficient funds.");
      return;
    }

    const { error } = await supabase.from("transactions").insert([
      {
        sender_id: user.id,
        recipient_id: recipientId,
        amount: Number(amount),
        type: "send",
        status: "completed",
      },
    ]);

    if (error) {
      alert("Transaction failed. Check console.");
      console.error("Send error:", error);
    } else {
      alert("Money sent successfully!");
      setAmount("");
      setRecipientId("");
      fetchBalance();
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "0 auto" }}>
      <h2>Send Money</h2>
      <p>
        <strong>Sender:</strong> {profile?.full_name || "Unknown"} (
        {profile?.phone || "No phone"})
      </p>
      <p>
        <strong>Balance:</strong> ${balance.toFixed(2)}
      </p>

      <div style={{ marginTop: "1rem" }}>
        <label><strong>Select Recipient</strong></label>
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.5rem" }}
        >
          <option value="">-- Select recipient --</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.full_name} ({recipient.phone || "No phone"})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label><strong>Amount</strong></label>
        <input
          type="number"
          value={amount.toString()}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          style={{ width: "100%", padding: "0.5rem", marginTop: "0.5rem" }}
        />
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <button
          onClick={handleSend}
          disabled={!recipientId || !amount || Number(amount) <= 0}
          style={{
            padding: "0.6rem 1.5rem",
            backgroundColor:
              !recipientId || !amount || Number(amount) <= 0 ? "#ccc" : "#00c2cb",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor:
              !recipientId || !amount || Number(amount) <= 0
                ? "not-allowed"
                : "pointer",
            fontWeight: "bold",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
