// pages/withdraw-wallet.jsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import Navbar from '../components/Navbar';

export default function WithdrawWalletPage() {
  const { user } = useUser();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount.');
      setLoading(false);
      return;
    }

    // Check current balance
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq('status', 'completed');

    if (error) {
      setErrorMsg('Failed to check wallet balance.');
      setLoading(false);
      return;
    }

    let walletBalance = 0;
    for (const tx of transactions) {
      if (tx.type === 'fund' && tx.sender_id === user.id) {
        walletBalance += tx.amount;
      } else if (tx.type === 'send') {
        if (tx.sender_id === user.id) walletBalance -= tx.amount;
        if (tx.recipient_id === user.id) walletBalance += tx.amount;
      } else if (tx.type === 'deposit') {
        if (tx.sender_id === user.id) walletBalance -= tx.amount;
      } else if (tx.type === 'withdraw') {
        if (tx.sender_id === user.id) walletBalance += tx.amount;
      }
    }

    if (amt > walletBalance) {
      setErrorMsg('Insufficient funds in wallet.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('transactions').insert([
      {
        sender_id: user.id,
        amount: amt,
        type: 'withdraw',
        status: 'completed',
        note,
      },
    ]);

    if (insertError) {
      setErrorMsg('Failed to process withdrawal.');
    } else {
      setSuccessMsg('Withdrawal successful!');
      setAmount('');
      setNote('');
    }

    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem' }}>
        <h1>Withdraw from Wallet</h1>
        <form onSubmit={handleWithdraw} style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Amount:</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Note:</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
              placeholder="e.g. personal use"
            />
          </div>
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </form>
        {errorMsg && <p style={{ color: 'red', marginTop: '1rem' }}>{errorMsg}</p>}
        {successMsg && <p style={{ color: 'green', marginTop: '1rem' }}>{successMsg}</p>}
      </div>
    </>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  fontSize: '16px',
  borderRadius: '5px',
  border: '1px solid #ccc',
};

const buttonStyle = {
  backgroundColor: '#dc3545',
  color: 'white',
  padding: '10px 20px',
  borderRadius: '5px',
  border: 'none',
  cursor: 'pointer',
};
