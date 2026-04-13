import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SendMoneyForm({ onClose }) {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  const handleSend = async () => {
    setMessage(null);
    const amt = parseFloat(amount);
    if (!user || !recipientId || !amt || amt <= 0) {
      setMessage('Enter a valid recipient and amount.');
      return;
    }

    if (recipientId === user.id) {
      setMessage("You can't send money to yourself.");
      return;
    }

    setLoading(true);

    // Get sender wallet
    const { data: senderWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!senderWallet || senderWallet.balance < amt) {
      setMessage('Insufficient funds.');
      setLoading(false);
      return;
    }

    // Deduct from sender wallet
    await supabase
      .from('wallets')
      .update({ balance: senderWallet.balance - amt })
      .eq('user_id', user.id);

    // Get or create recipient wallet
    const { data: recipientWallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', recipientId)
      .single();

    if (recipientWallet) {
      await supabase
        .from('wallets')
        .update({ balance: recipientWallet.balance + amt })
        .eq('user_id', recipientId);
    } else {
      await supabase.from('wallets').insert([
        { user_id: recipientId, balance: amt },
      ]);
    }

    // Insert transaction for sender
    await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'send',
        amount: amt,
        description: `Sent to ${recipientId}`,
      },
    ]);

    // Insert transaction for recipient
    await supabase.from('transactions').insert([
      {
        user_id: recipientId,
        type: 'receive',
        amount: amt,
        description: `Received from ${user.id}`,
      },
    ]);

    setMessage('Money sent!');
    setAmount('');
    setRecipientId('');
    setLoading(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Send Money</h2>
        <input
          type="text"
          placeholder="Recipient ID"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="w-full px-4 py-2 mb-3 border rounded"
        />
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
            onClick={handleSend}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
