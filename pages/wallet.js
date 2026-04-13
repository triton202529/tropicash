import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import Navbar from '../components/Navbar';

export default function WalletPage() {
  const { user } = useUser();
  const router = useRouter();
  const [walletBalance, setWalletBalance] = useState(0);
  const [tritonBalance, setTritonBalance] = useState(0);

  useEffect(() => {
    async function fetchBalances() {
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'completed');

      if (error) {
        console.error('Error fetching transactions:', error.message);
        return;
      }

      let wallet = 0;
      let triton = 0;

      for (const tx of data) {
        if (tx.type === 'fund' && tx.sender_id === user.id) {
          wallet += tx.amount;
        } else if (tx.type === 'send') {
          if (tx.sender_id === user.id) wallet -= tx.amount;
          if (tx.recipient_id === user.id) wallet += tx.amount;
        } else if (tx.type === 'deposit') {
          if (tx.sender_id === user.id) {
            wallet -= tx.amount;
            triton += tx.amount;
          }
        } else if (tx.type === 'withdraw') {
          if (tx.sender_id === user.id) {
            wallet += tx.amount;
            triton -= tx.amount;
          }
        }
      }

      setWalletBalance(wallet);
      setTritonBalance(triton);
    }

    fetchBalances();
  }, [user]);

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem' }}>
        <h1>Tropicash Wallet</h1>

        <div
          style={{
            backgroundColor: '#f0f0f0',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <p><strong>Wallet Balance:</strong> ${walletBalance.toFixed(2)}</p>
        </div>

        <h3 style={{ marginTop: '1rem' }}>Tropicash Actions</h3>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/send-money')}
            style={buttonStyle('#007bff')}
          >
            Send Money
          </button>

          <button
            onClick={() => router.push('/fund-wallet')}
            style={buttonStyle('#6f42c1')}
          >
            Fund Wallet
          </button>

          <button
            onClick={() => router.push('/transactions')}
            style={buttonStyle('#343a40')}
          >
            View History
          </button>

          <button
            onClick={() => router.push('/withdraw-wallet')}
            style={buttonStyle('#dc3545')}
          >
            Withdraw from Wallet
          </button>
        </div>

        <hr style={{ margin: '2rem 0', borderTop: '2px solid #ccc' }} />

        <h3>Triton AI Trading Integration</h3>
        <div>
          <div
            style={{
              backgroundColor: '#e9ecef',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}
          >
            <p><strong>Triton Balance:</strong> ${tritonBalance.toFixed(2)}</p>
          </div>

          <button
            onClick={() => router.push('/deposit')}
            style={buttonStyle('#28a745')}
          >
            Deposit to Triton
          </button>

          <button
            onClick={() => router.push('/withdraw')}
            style={buttonStyle('#fd7e14')}
          >
            Withdraw from Triton
          </button>
        </div>
      </div>
    </>
  );
}

function buttonStyle(bgColor) {
  return {
    backgroundColor: bgColor,
    color: 'white',
    padding: '10px 20px',
    borderRadius: '5px',
    border: 'none',
    marginRight: '10px',
    marginTop: '10px',
    cursor: 'pointer',
  };
}
