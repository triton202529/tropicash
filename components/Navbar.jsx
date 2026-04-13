import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/userContext';
import Image from 'next/image';
import logo from '../assets/logo.png'; // Ensure you have a logo.png in assets

export default function Navbar() {
  const { user, profile } = useUser();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
      <div
        className="flex items-center cursor-pointer"
        onClick={() => router.push('/wallet')}
      >
        <Image src={logo} alt="Logo" width={30} height={30} />
        <span className="ml-2 text-xl font-bold">Tropicash</span>
      </div>

      {profile && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown((prev) => !prev)}
            className="flex items-center space-x-2 bg-blue-700 px-3 py-2 rounded hover:bg-blue-800"
          >
            <span>{profile.full_name?.split(' ')[0] || 'User'}</span>
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
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
