import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserProfile, updateUserProfile } from '../lib/profileService';
import { getTransactionHistory } from '../lib/transactionService';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const profile = await getUserProfile(user.id);
        setProfile(profile);
        setNewName(profile?.full_name || '');
        setNewPhone(profile?.phone || '');
        const tx = await getTransactionHistory(user.id);
        setTransactions(tx);
      }
    };
    fetchData();
  }, []);

  const handleUpdateProfile = async () => {
    await updateUserProfile(user.id, {
      full_name: newName,
      phone: newPhone,
    });
    const updated = await getUserProfile(user.id);
    setProfile(updated);
    setEditing(false);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${user.id}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, selectedFile, {
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update failed:', updateError.message);
      return;
    }

    const updated = await getUserProfile(user.id);
    setProfile(updated);
    setSelectedFile(null);
  };

  return (
    <div className="min-h-screen bg-blue-50 py-10 px-4">
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Profile</h1>

        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-2"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-300 mx-auto mb-2 flex items-center justify-center text-sm text-gray-600">
            Default<br />Avatar
          </div>
        )}

        <input type="file" onChange={handleFileChange} className="block mx-auto mt-2" />
        <button
          onClick={handleUpload}
          className="text-sm text-blue-600 hover:underline block text-center mt-1"
        >
          Upload
        </button>

        <div className="mt-4 space-y-1 text-gray-800 text-sm">
          <p><strong>Full Name:</strong> {profile?.full_name || 'N/A'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Phone:</strong> {profile?.phone || 'N/A'}</p>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="bg-blue-600 text-white mt-4 w-full py-2 rounded-md hover:bg-blue-700 transition"
        >
          Edit Profile
        </button>
      </div>

      {editing && (
        <div className="max-w-md mx-auto bg-white p-4 mt-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <input
            type="text"
            placeholder="Full Name"
            className="w-full border px-3 py-2 rounded"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Phone"
            className="w-full border px-3 py-2 rounded"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpdateProfile}
              className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto mt-8 bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {transactions.map((tx) => (
              <li key={tx.id} className="border-b pb-1">
                ${tx.amount} to/from {tx.sender_id === user.id ? 'you' : tx.sender_id}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
