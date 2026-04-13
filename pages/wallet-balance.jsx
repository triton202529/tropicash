// pages/wallet-balance.jsx
import { useEffect, useState } from 'react';
import { useUser } from '..@/lib/UserContext';
import { supabase } from '../lib/supabaseClient';

export default function WalletBalancePage() {
  const { user } = useUser();
  const [balance, setBalance] = useState(0);
  const [funded, setFunded] = useState(0);
  const [sent, setSent] = useState(0);
  const [received, setReceived] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) {
        setStatus('Please log in to view your balance.');
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);

      if (error) {
        console.error('Failed to fetch transactions:', error.message);
        setStatus('Failed to load transactions.');
        return;
      }

      let totalFunded = 0;
      let totalSent = 0;
      let totalReceived = 0;

      data.forEach((tx) => {
        const isFunding =
          tx.type === 'fund_wallet' &&
          (tx.sender_id === null || tx.sender_id === undefined) &&
          tx.recipient_id === user.id;

        const isSent = tx.sender_id === user.id && tx.recipient_id !== user.id;
        const isReceived = tx.recipient_id === user.id && tx.sender_id !== user.id;

        if (isFunding) {
          totalFunded += tx.amount;
        } else if (isSent) {
          totalSent += tx.amount;
        } else if (isReceived) {
          totalReceived += tx.amount;
        }
      });

      const currentBalance = totalFunded + totalReceived - totalSent;

      setFunded(totalFunded);
      setSent(totalSent);
      setReceived(totalReceived);
      setBalance(currentBalance);
    };

    fetchTransactions();
  }, [user]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Wallet Balance</h2>
      {status && <p>{status}</p>}

      {!status && (
        <div style={{ marginTop: '1rem' }}>
          <p><strong>Current Balance:</strong> ${balance.toFixed(2)}</p>
          <p><strong>Total Funded:</strong> ${funded.toFixed(2)}</p>
          <p><strong>Total Received:</strong> ${received.toFixed(2)}</p>
          <p><strong>Total Sent:</strong> ${sent.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
