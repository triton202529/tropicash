import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DepositToTritonForm({ onClose }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  const handleDeposit = async () => {
    setMessage(null);
    const amt = parseFloat(amount);
    if (!user || !amt || amt <= 0) {
      setMessage('Enter a valid amount.');
      return;
    }

    setLoading(true);

    // Get wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet || walletErr || wallet.balance < amt) {
      setMessage('Insufficient funds.');
      setLoading(false);
      return;
    }

    // Subtract from wallet
    const newWalletBalance = wallet.balance - amt;
    await supabase
      .from('wallets')
      .update({ balance: newWalletBalance })
      .eq('user_id', user.id);

    // Add to Triton balance
    const { data: triton } = await supabase
      .from('triton_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (triton) {
      const newTritonBalance = triton.balance + amt;
      await supabase
        .from('triton_balances')
        .update({ balance: newTritonBalance })
        .eq('user_id', user.id);
    } else {
      await supabase.from('triton_balances').insert([
        { user_id: user.id, balance: amt },
      ]);
    }

    // ✅ Log the deposit in transactions
    await supabase.from('transactions').insert([
      {
        sender_id: user.id,
        recipient_id: null,
        amount: amt,
        type: 'deposit_to_triton',
        source: 'tropicash',
      },
    ]);

    setMessage('Deposited successfully!');
    setAmount('');
    setLoading(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Deposit to Triton</h2>
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-2 mb-3 border rounded"
        />
        {message && <p className="text-sm text-red-500 mb-3">{message}</p>}
        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {loading ? 'Processing...' : 'Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}
