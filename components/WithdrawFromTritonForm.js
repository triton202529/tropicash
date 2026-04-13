import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function WithdrawFromTritonForm({ onClose }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  const handleWithdraw = async () => {
    setMessage(null);
    const amt = parseFloat(amount);
    if (!user || !amt || amt <= 0) {
      setMessage('Enter a valid amount.');
      return;
    }

    setLoading(true);

    // Get Triton balance
    const { data: triton, error: tritonErr } = await supabase
      .from('triton_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!triton || tritonErr || triton.balance < amt) {
      setMessage('Insufficient Triton balance.');
      setLoading(false);
      return;
    }

    // Deduct from Triton
    await supabase
      .from('triton_balances')
      .update({ balance: triton.balance - amt })
      .eq('user_id', user.id);

    // Add to wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (wallet) {
      await supabase
        .from('wallets')
        .update({ balance: wallet.balance + amt })
        .eq('user_id', user.id);
    } else {
      await supabase.from('wallets').insert([
        { user_id: user.id, balance: amt },
      ]);
    }

    // ✅ Log transaction
    await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'withdraw',
        amount: amt,
        description: 'Triton → Tropicash',
      },
    ]);

    setMessage('Withdraw successful!');
    setAmount('');
    setLoading(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Withdraw from Triton</h2>
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
            onClick={handleWithdraw}
            disabled={loading}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            {loading ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}
