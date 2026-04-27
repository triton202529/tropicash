import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import { getUserProfile, updateUserProfile } from '../lib/profileService';
import { getTransactionHistory } from '../lib/transactionService';
import {
  getSoftEnforcementBanner,
  softEnforcementLightPanelClassNames,
  getAccountStatusUserLabel,
  getRiskTierUserLabel,
  getAccountFlagsUserLabels,
} from '../lib/softEnforcement';

export default function ProfilePage() {
  const { user, profile, loading } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [localProfile, setLocalProfile] = useState(null);

  const displayProfile = localProfile ?? profile;

  useEffect(() => {
    setLocalProfile(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;
    getTransactionHistory(user.id).then(setTransactions);
  }, [user?.id, loading]);

  useEffect(() => {
    if (profile) {
      setNewName(profile.full_name || '');
      setNewPhone(profile.phone || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    const ok = await updateUserProfile(user.id, {
      full_name: newName,
      phone: newPhone,
    });
    if (ok) {
      const updated = await getUserProfile(user.id);
      setLocalProfile(updated);
      setEditing(false);
    }
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
    setLocalProfile(updated);
    setSelectedFile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 py-10 px-4">
        <p className="text-center">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-50 py-10 px-4">
        <p className="text-center">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-10 px-4">
      <div className="mx-auto max-w-md rounded-[14px] border border-[#e2e8f0] bg-white p-6 shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
        <h1 className="mb-6 text-center text-2xl font-bold text-[#0f172a]">Profile</h1>

        {displayProfile
          ? (() => {
              try {
                const b = getSoftEnforcementBanner(displayProfile);
                if (!b) return null;
                const c = softEnforcementLightPanelClassNames(b.tone);
                return (
                  <div className={c.wrap} role="status">
                    <p className={c.title}>{b.title}</p>
                    <p className={c.body}>{b.message}</p>
                  </div>
                );
              } catch (e) {
                console.error(e);
                return null;
              }
            })()
          : null}

        {displayProfile?.avatar_url ? (
          <img
            src={displayProfile.avatar_url}
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

        <div className="mt-4 space-y-1 text-sm text-[#0f172a]">
          <p><strong className="text-[#94a3b8]">Full Name:</strong> {displayProfile?.full_name || '—'}</p>
          <p><strong className="text-[#94a3b8]">Email:</strong> {displayProfile?.email || user?.email || '—'}</p>
          <p><strong className="text-[#94a3b8]">Phone:</strong> {displayProfile?.phone || '—'}</p>
        </div>

        {displayProfile ? (
          <div className="mt-5 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">Account status</h2>
            <p className="text-sm text-[#0f172a]">
              <span className="font-semibold text-[#64748b]">Status: </span>
              {getAccountStatusUserLabel(displayProfile)}
            </p>
            <p className="mt-2 text-sm text-[#0f172a]">
              <span className="font-semibold text-[#64748b]">Activity review level: </span>
              {getRiskTierUserLabel(displayProfile)}
            </p>
            {String(displayProfile.account_status || 'active').toLowerCase() === 'restricted' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
                We&apos;re completing an internal review. You can still use your profile and wallet; some actions may be monitored.
              </p>
            ) : (
              (() => {
                try {
                  const labels = getAccountFlagsUserLabels(displayProfile);
                  if (!labels.length) {
                    return (
                      <p className="mt-2 text-sm text-[#94a3b8]">No additional account notices.</p>
                    );
                  }
                  return (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Notices</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-[#475569]">
                        {labels.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  );
                } catch (e) {
                  console.error(e);
                  return null;
                }
              })()
            )}
          </div>
        ) : null}

        <button
          onClick={() => setEditing(true)}
          className="bg-blue-600 text-white mt-4 w-full py-2 rounded-md hover:bg-blue-700 transition"
        >
          Edit Profile
        </button>
      </div>

      {editing && (
        <div className="mx-auto mt-6 max-w-md space-y-4 rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
          <h3 className="text-lg font-semibold text-[#0f172a]">Edit Profile</h3>
          <input
            type="text"
            placeholder="Full Name"
            className="w-full rounded-[10px] border border-[#cbd5e1] bg-[#f4f6f9] px-3 py-2 text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Phone"
            className="w-full rounded-[10px] border border-[#cbd5e1] bg-[#f4f6f9] px-3 py-2 text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
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

      <div className="mx-auto mt-8 max-w-md rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
        <h3 className="mb-2 text-lg font-semibold text-[#0f172a]">Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-[#64748b]">No transactions yet.</p>
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
