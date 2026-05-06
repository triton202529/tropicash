// pages/wallet-balance.jsx
import { useEffect, useState } from 'react';
import { useUser } from '../lib/userContext';
import { supabase } from '../lib/supabaseClient';

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "520px",
  margin: "0 auto",
  minHeight: "100vh",
  boxSizing: "border-box",
  background: "transparent",
};

export default function WalletBalancePage() {
  const { user, loading } = useUser();
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (loading) return;

    const fetchWallet = async () => {
      if (!user) {
        setStatus('Please log in to view your balance.');
        return;
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch wallet:', error.message);
        setStatus('Failed to load wallet.');
        return;
      }

      const row = data;
      const raw = row?.wallet_balance ?? row?.balance ?? 0;
      const n = Number(raw);
      setBalance(Number.isFinite(n) ? n : 0);
    };

    fetchWallet();
  }, [user, loading]);

  if (loading) {
    return (
      <div style={pageWrap}>
        <h2 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>Wallet Balance</h2>
        <p style={{ marginTop: "0.75rem", color: "#64748b" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <h2 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>Wallet Balance</h2>
      {status ? <p style={{ marginTop: "0.75rem", color: "#64748b" }}>{status}</p> : null}

      {!status && (
        <div
          style={{
            marginTop: "1.25rem",
            padding: "1.15rem 1.2rem",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p style={{ margin: 0, color: "#0f172a" }}><strong style={{ color: "#94a3b8" }}>Current Balance:</strong> ${balance.toFixed(2)}</p>
          <p style={{ margin: "0.65rem 0 0", color: "#0f172a" }}><strong style={{ color: "#94a3b8" }}>Total Funded:</strong> —</p>
          <p style={{ margin: "0.65rem 0 0", color: "#0f172a" }}><strong style={{ color: "#94a3b8" }}>Total Received:</strong> —</p>
          <p style={{ margin: "0.65rem 0 0", color: "#0f172a" }}><strong style={{ color: "#94a3b8" }}>Total Sent:</strong> —</p>
        </div>
      )}
    </div>
  );
}
