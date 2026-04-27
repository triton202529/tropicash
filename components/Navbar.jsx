import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import { isAdminUser } from '../lib/adminAccess';
import { getSoftEnforcementState } from '../lib/softEnforcement';
import Image from 'next/image';
import logo from '../assets/logo.png'; // Ensure you have a logo.png in assets
import NotificationsBell from './NotificationsBell';

export default function Navbar() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const displayName = profile?.full_name?.split(' ')[0] || 'User';

  let accountNoticeDot = false;
  try {
    const st = profile ? getSoftEnforcementState(profile) : null;
    accountNoticeDot = !!(st && st.accountStatus !== 'active');
  } catch (e) {
    console.error(e);
  }

  return (
    <nav className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
      <div
        className="flex items-center cursor-pointer"
        onClick={() => router.push('/wallet')}
      >
        <Image src={logo} alt="Logo" width={30} height={30} />
        <span className="ml-2 text-xl font-bold">Tropicash</span>
      </div>

      {loading ? (
        <span className="text-sm">Loading...</span>
      ) : user ? (
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <div className="relative z-10">
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className="flex items-center space-x-2 bg-blue-700 px-3 py-2 rounded hover:bg-blue-800"
            >
              <span className="flex items-center gap-1.5">
                {displayName}
                {accountNoticeDot ? (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400"
                    title="Account notice"
                    aria-label="Account notice"
                  />
                ) : null}
              </span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-10">
                <button
                  onClick={() => router.push('/profile')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  View Profile
                </button>
                {isAdminUser(user, profile) ? (
                  <>
                    <button
                      onClick={() => router.push('/admin')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Admin
                    </button>
                    <button
                      onClick={() => router.push('/admin/alerts')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Alert center
                    </button>
                    <button
                      onClick={() => router.push('/admin/cases')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Cases
                    </button>
                  </>
                ) : null}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
