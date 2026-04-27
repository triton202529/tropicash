// pages/login.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push('/wallet'); // redirect after login
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-[14px] border border-[#e2e8f0] bg-white p-8 shadow-[0_8px_25px_rgba(15,23,42,0.08)]">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">Login to Tropicash</h2>
        {errorMsg && (
          <div className="text-red-600 text-sm mb-4 text-center">{errorMsg}</div>
        )}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-[10px] border border-[#cbd5e1] bg-[#f4f6f9] px-4 py-2 text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-[10px] border border-[#cbd5e1] bg-[#f4f6f9] px-4 py-2 text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-200"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
