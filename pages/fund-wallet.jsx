import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";

export default function FundWalletPage() {
  const { user, profile } = useUser();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Load PayPal script once
  useEffect(() => {
    const existingScript = document.getElementById("paypal-sdk");
    if (!existingScript) {
      const script = document.createElement("script");
      script.src =
        "https://www.paypal.com/sdk/js?client-id=AeFm4YjDu6_2suXIukYfT5ikW3zo65YWbav1FX4CenxS7pXOH0rC8YNfUQWi-ShU6X1FJFLGkUmaEcNU&currency=USD";
      script.id = "paypal-sdk";
      script.onload = () => console.log("PayPal SDK loaded");
      document.body.appendChild(script);
    }
  }, []);

  // Render PayPal button once amount is set
  useEffect(() => {
    if (typeof window !== "undefined" && window.paypal && paidAmount) {
      window.paypal
        .Buttons({
          createOrder: (data, actions) => {
            return actions.order.create({
              purchase_units: [
                {
                  amount: {
                    value: paidAmount,
                  },
                },
              ],
            });
          },
          onApprove: async (data, actions) => {
            const details = await actions.order.capture();
            console.log("Payment approved:", details);

            const amt = parseFloat(paidAmount);
            setLoading(true);

            // Update wallet
            const { data: existingWallet } = await supabase
              .from("wallets")
              .select("*")
              .eq("user_id", user.id)
              .single();

            if (existingWallet) {
              await supabase
                .from("wallets")
                .update({ balance: existingWallet.balance + amt })
                .eq("user_id", user.id);
            } else {
              await supabase
                .from("wallets")
                .insert([{ user_id: user.id, balance: amt }]);
            }

            // Log transaction
            await supabase.from("transactions").insert([
              {
                sender_id: user.id,
                recipient_id: user.id,
                amount: amt,
                type: "fund",
                source: "paypal",
                description: "Wallet funded via PayPal",
                status: "completed",
              },
            ]);

            setLoading(false);
            router.push("/wallet");
          },
          onError: (err) => {
            console.error("PayPal error:", err);
            setErrorMsg("Payment failed. Try again.");
            setLoading(false);
          },
        })
        .render("#paypal-button-container");
    }
  }, [paidAmount, user, router]);

  const handlePay = () => {
    setErrorMsg("");
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setErrorMsg("Please enter a valid amount.");
      return;
    }
    setPaidAmount(parseFloat(amount).toFixed(2));
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "0 auto" }}>
      <h2>Fund Wallet</h2>
      <p>
        <strong>User:</strong> {profile?.full_name || "Unknown"} (
        {profile?.phone || "No phone"})
      </p>

      <label style={{ display: "block", marginTop: "1rem" }}>Amount (USD)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount"
        style={{
          padding: "10px",
          width: "100%",
          marginBottom: "1rem",
          display: "block",
        }}
      />

      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      {!paidAmount && (
        <button
          onClick={handlePay}
          disabled={loading}
          style={{
            backgroundColor: "#6f42c1",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Processing..." : "Pay with PayPal"}
        </button>
      )}

      <div id="paypal-button-container" style={{ marginTop: "1rem" }}></div>
    </div>
  );
}
