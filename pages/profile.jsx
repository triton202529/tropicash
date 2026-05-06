import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import { getUserProfile } from '../lib/profileService';
import { getTransactionHistory } from '../lib/transactionService';
import Navbar from '../components/Navbar';
import {
  getSoftEnforcementBanner,
  softEnforcementLightPanelClassNames,
  getAccountStatusUserLabel,
  getRiskTierUserLabel,
  getAccountFlagsUserLabels,
} from '../lib/softEnforcement';
import {
  fetchPayoutMethodsForUser,
  savePayoutMethodForUser,
  formatPayoutDestinationDisplay,
} from '../lib/payoutMethods';

const PAYOUT_BRAND_PRESETS = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];

function isValidPayoutEmail(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function ProfilePage() {
  const { user, profile, loading } = useUser();

  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [localProfile, setLocalProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState({ type: null, message: '' });

  const [payoutMethods, setPayoutMethods] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutFeedback, setPayoutFeedback] = useState({ type: null, message: '' });
  const [payoutEmailField, setPayoutEmailField] = useState('');
  const [payoutEmailSaving, setPayoutEmailSaving] = useState(false);
  const [payoutEditOpen, setPayoutEditOpen] = useState(false);
  const [pmCardholder, setPmCardholder] = useState('');
  const [pmBrandPreset, setPmBrandPreset] = useState('Visa');
  const [pmBrandOther, setPmBrandOther] = useState('');
  const [pmLast4, setPmLast4] = useState('');
  const [pmLabel, setPmLabel] = useState('');

  const displayProfile = localProfile ?? profile;

  const defaultPayoutMethod =
    payoutMethods.find((m) => m.is_default) || (payoutMethods.length ? payoutMethods[0] : null);

  const hydratePayoutFormFromMethod = useCallback((m) => {
    if (!m) {
      setPmCardholder('');
      setPmBrandPreset('Visa');
      setPmBrandOther('');
      setPmLast4('');
      setPmLabel('');
      return;
    }
    setPmCardholder(m.cardholder_name || '');
    const b = String(m.brand || '').trim();
    if (PAYOUT_BRAND_PRESETS.slice(0, -1).includes(b)) {
      setPmBrandPreset(b);
      setPmBrandOther('');
    } else {
      setPmBrandPreset('Other');
      setPmBrandOther(b);
    }
    setPmLast4(m.last4 || '');
    setPmLabel(m.payout_label || '');
  }, []);

  const loadPayoutMethods = useCallback(async () => {
    if (!user?.id) return;
    setPayoutLoading(true);
    setPayoutFeedback({ type: null, message: '' });
    const { rows, error } = await fetchPayoutMethodsForUser(user.id);
    setPayoutMethods(rows);
    if (error) {
      setPayoutFeedback({
        type: 'error',
        message:
          'Could not load payout methods. If this persists, confirm the payout_methods table exists in your database.',
      });
      setPayoutLoading(false);
      return;
    }
    const dm = rows.find((m) => m.is_default) || rows[0];
    hydratePayoutFormFromMethod(dm || null);
    setPayoutEditOpen(rows.length === 0);
    setPayoutLoading(false);
  }, [user?.id, hydratePayoutFormFromMethod]);

  useEffect(() => {
    setLocalProfile(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;
    getTransactionHistory(user.id).then(setTransactions);
  }, [user?.id, loading]);

  useEffect(() => {
    if (!user?.id || loading) return;
    loadPayoutMethods();
  }, [user?.id, loading, loadPayoutMethods]);

  useEffect(() => {
    if (profile) {
      setNewName(profile.full_name || '');
      setNewPhone(profile.phone || '');
      setPayoutEmailField(String(profile.payout_email || '').trim());
    }
  }, [profile]);

  const mapProfileSaveErrorMessage = (err) => {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();

    if (code === '23505' && (msg.includes('profiles_phone_key') || msg.includes('duplicate key'))) {
      return 'This phone number is already linked to another Tropicash account. Please use a different number.';
    }

    return err?.message || 'Could not save profile.';
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;

    setSaveFeedback({ type: null, message: '' });
    setSaving(true);

    const cleanPhone = newPhone.trim();

    try {
      if (cleanPhone) {
        const { data: existingRows, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', cleanPhone)
          .neq('id', user.id)
          .limit(1);

        if (checkError) {
          console.error('[profile] pre-check failed:', checkError);
        }

        if (existingRows && existingRows.length > 0) {
          setSaveFeedback({
            type: 'error',
            message:
              'This phone number is already linked to another Tropicash account. Please use a different number.',
          });
          setSaving(false);
          return;
        }
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: newName,
          phone: cleanPhone || '',
        })
        .eq('id', user.id)
        .select('*');

      if (updateError) {
        console.error('[profile] save update failed:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
          raw: updateError,
        });

        setSaveFeedback({
          type: 'error',
          message: mapProfileSaveErrorMessage(updateError),
        });
        return;
      }

      let row = Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null;

      if (!row) {
        const { data: upserted, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              full_name: newName,
              phone: cleanPhone || '',
              email: user.email,
            },
            { onConflict: 'id' },
          )
          .select('*')
          .single();

        if (upsertError) {
          console.error('[profile] save upsert failed:', {
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            code: upsertError.code,
            raw: upsertError,
          });

          setSaveFeedback({
            type: 'error',
            message: mapProfileSaveErrorMessage(upsertError),
          });
          return;
        }

        row = upserted;
      }

      const refreshed = await getUserProfile(user.id);
      setLocalProfile(refreshed || row);
      setSaveFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setEditing(false);
    } catch (err) {
      console.error('[profile] save unexpected error:', err);
      setSaveFeedback({
        type: 'error',
        message: err?.message || 'Something went wrong while saving.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const brandForSave = () => {
    if (pmBrandPreset === 'Other') return pmBrandOther.trim();
    return pmBrandPreset;
  };

  const handleSavePayPalPayoutEmail = async () => {
    if (!user?.id) return;
    setPayoutFeedback({ type: null, message: '' });
    const trimmed = String(payoutEmailField || '').trim().toLowerCase();
    if (!isValidPayoutEmail(trimmed)) {
      setPayoutFeedback({
        type: 'error',
        message: 'Enter a valid PayPal payout email address.',
      });
      return;
    }
    setPayoutEmailSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ payout_email: trimmed })
        .eq('id', user.id);
      if (error) {
        setPayoutFeedback({
          type: 'error',
          message: error.message || 'Could not save PayPal email.',
        });
        return;
      }
      const refreshed = await getUserProfile(user.id);
      setLocalProfile(refreshed);
      setPayoutEmailField(trimmed);
      setPayoutFeedback({ type: 'success', message: 'PayPal payout email saved.' });
    } catch (err) {
      console.error('[profile] payout email save', err);
      setPayoutFeedback({
        type: 'error',
        message: err?.message || 'Something went wrong while saving.',
      });
    } finally {
      setPayoutEmailSaving(false);
    }
  };

  const handleSavePayoutMethod = async () => {
    if (!user?.id) return;
    setPayoutFeedback({ type: null, message: '' });
    setPayoutSaving(true);
    try {
      const { data, error } = await savePayoutMethodForUser(
        user.id,
        {
          cardholder_name: pmCardholder,
          brand: brandForSave(),
          last4: pmLast4,
          payout_label: pmLabel,
        },
        defaultPayoutMethod?.id,
      );

      if (error) {
        const msg = error?.message || 'Could not save payout method.';
        setPayoutFeedback({ type: 'error', message: msg });
        setPayoutSaving(false);
        return;
      }

      const { rows } = await fetchPayoutMethodsForUser(user.id);
      setPayoutMethods(rows);
      const dm = rows.find((m) => m.id === data?.id) || rows.find((m) => m.is_default) || rows[0];
      hydratePayoutFormFromMethod(dm || null);
      setPayoutEditOpen(false);
      setPayoutFeedback({ type: 'success', message: 'Payout method saved.' });
    } catch (err) {
      console.error('[profile] payout save', err);
      setPayoutFeedback({
        type: 'error',
        message: err?.message || 'Something went wrong while saving the payout method.',
      });
    } finally {
      setPayoutSaving(false);
    }
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
      <>
        <Navbar />
        <div className="min-h-screen px-4 py-10">
          <p className="text-center">Loading...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen px-4 py-10">
          <p className="text-center">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-md rounded-[14px] p-6 tropicash-surface">
          <h1 className="mb-6 text-center text-2xl font-bold text-[#0f172a]">Profile</h1>

          {saveFeedback.type === 'success' && saveFeedback.message ? (
            <p
              className="mb-4 rounded-[10px] border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-800"
              role="status"
            >
              {saveFeedback.message}
            </p>
          ) : null}

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
              Default
              <br />
              Avatar
            </div>
          )}

          <input type="file" onChange={handleFileChange} className="block mx-auto mt-2" />

          <button
            type="button"
            onClick={handleUpload}
            className="text-sm text-blue-600 hover:underline block text-center mt-1"
          >
            Upload
          </button>

          <div className="mt-4 space-y-1 text-sm text-[#0f172a]">
            <p>
              <strong className="text-[#94a3b8]">Full Name:</strong>{' '}
              {displayProfile?.full_name || '—'}
            </p>
            <p>
              <strong className="text-[#94a3b8]">Email:</strong>{' '}
              {displayProfile?.email || user?.email || '—'}
            </p>
            <p>
              <strong className="text-[#94a3b8]">Phone:</strong>{' '}
              {displayProfile?.phone || '—'}
            </p>
          </div>

          {displayProfile ? (
            <div className="mt-5 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                Account status
              </h2>

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
                  We&apos;re completing an internal review. You can still use your profile and
                  wallet; some actions may be monitored.
                </p>
              ) : (
                (() => {
                  try {
                    const labels = getAccountFlagsUserLabels(displayProfile);

                    if (!labels.length) {
                      return (
                        <p className="mt-2 text-sm text-[#94a3b8]">
                          No additional account notices.
                        </p>
                      );
                    }

                    return (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                          Notices
                        </p>
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

          <div className="mt-5 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
              Payout settings
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-[#64748b]">
              This email will be used to receive withdrawals via PayPal.
            </p>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              PayPal email
            </label>
            <input
              type="email"
              className="mb-3 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
              value={payoutEmailField}
              onChange={(e) => setPayoutEmailField(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <button
              type="button"
              onClick={() => void handleSavePayPalPayoutEmail()}
              disabled={payoutEmailSaving}
              className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payoutEmailSaving ? 'Saving…' : 'Save PayPal email'}
            </button>
          </div>

          <div className="mt-5 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] p-4 text-left">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
              Payout method
            </h2>

            {payoutLoading ? (
              <p className="text-sm text-[#64748b]">Loading payout method…</p>
            ) : null}

            {!payoutLoading && defaultPayoutMethod && !payoutEditOpen ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0f172a]">
                  {formatPayoutDestinationDisplay(defaultPayoutMethod)}
                </p>
                <p className="text-sm text-[#475569]">
                  <span className="font-semibold text-[#64748b]">Cardholder: </span>
                  {defaultPayoutMethod.cardholder_name || '—'}
                </p>
                <p className="text-sm text-[#475569]">
                  <span className="font-semibold text-[#64748b]">Brand: </span>
                  {defaultPayoutMethod.brand || '—'}
                  <span className="mx-2 text-[#cbd5e1]">·</span>
                  <span className="font-semibold text-[#64748b]">Last 4: </span>••••
                  {defaultPayoutMethod.last4}
                </p>
                {defaultPayoutMethod.is_default ? (
                  <p className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                    Default payout method
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setPayoutFeedback({ type: null, message: '' });
                    hydratePayoutFormFromMethod(defaultPayoutMethod);
                    setPayoutEditOpen(true);
                  }}
                  className="mt-3 w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Update payout method
                </button>
              </div>
            ) : null}

            {!payoutLoading && payoutEditOpen ? (
              <div className="space-y-3">
                <p className="text-xs text-[#64748b]">
                  For soft launch we only store cardholder name, brand, last 4 digits, and an optional
                  label — not your full card number.
                </p>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    Cardholder name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
                    value={pmCardholder}
                    onChange={(e) => setPmCardholder(e.target.value)}
                    placeholder="Name on card"
                    autoComplete="cc-name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    Card brand
                  </label>
                  <select
                    className="w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
                    value={pmBrandPreset}
                    onChange={(e) => setPmBrandPreset(e.target.value)}
                  >
                    {PAYOUT_BRAND_PRESETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {pmBrandPreset === 'Other' ? (
                    <input
                      type="text"
                      className="mt-2 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
                      value={pmBrandOther}
                      onChange={(e) => setPmBrandOther(e.target.value)}
                      placeholder="Enter brand"
                    />
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    Last 4 digits
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
                    value={pmLast4}
                    onChange={(e) => setPmLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
                    value={pmLabel}
                    onChange={(e) => setPmLabel(e.target.value)}
                    placeholder='e.g. "Visa ending 1234"'
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSavePayoutMethod}
                    disabled={payoutSaving}
                    className="flex-1 rounded-md bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {payoutSaving ? 'Saving…' : 'Save payout method'}
                  </button>
                  {defaultPayoutMethod ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutFeedback({ type: null, message: '' });
                        hydratePayoutFormFromMethod(defaultPayoutMethod);
                        setPayoutEditOpen(false);
                      }}
                      disabled={payoutSaving}
                      className="flex-1 rounded-md bg-gray-200 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {payoutFeedback.type === 'success' && payoutFeedback.message ? (
              <p
                className="mt-3 rounded-[10px] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                role="status"
              >
                {payoutFeedback.message}
              </p>
            ) : null}
            {payoutFeedback.type === 'error' && payoutFeedback.message ? (
              <p
                className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {payoutFeedback.message}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setSaveFeedback({ type: null, message: '' });
              setEditing(true);
            }}
            className="bg-blue-600 text-white mt-4 w-full py-2 rounded-md hover:bg-blue-700 transition"
          >
            Edit Profile
          </button>
        </div>

        {editing && (
          <div className="mx-auto mt-6 max-w-md space-y-4 rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
            <h3 className="text-lg font-semibold text-[#0f172a]">Edit Profile</h3>

            {saveFeedback.type === 'error' && saveFeedback.message ? (
              <p
                className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {saveFeedback.message}
              </p>
            ) : null}

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
                type="button"
                onClick={handleUpdateProfile}
                disabled={saving}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditing(false);

                  const base = localProfile ?? profile;

                  if (base) {
                    setNewName(base.full_name || '');
                    setNewPhone(base.phone || '');
                  }

                  setSaveFeedback({ type: null, message: '' });
                }}
                disabled={saving}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
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
    </>
  );
}
