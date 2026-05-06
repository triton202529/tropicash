// pages/login.jsx
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import {
  authCardClass,
  authErrorBoxClass,
  authFormStackClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPageShellClass,
  authPrimaryBtnClass,
  authSubtitleClass,
  authTitleClass,
  authTopRowClass,
} from "../lib/authFormUi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.push("/wallet");
    }
  };

  return (
    <>
      <Navbar />
      <div className={authPageShellClass}>
        <div className={authTopRowClass}>
          <Link href="/" className={authLinkClass}>
            ← Back to home
          </Link>
          <Link href="/auth" className={authLinkClass}>
            Sign up
          </Link>
        </div>
        <div className={authCardClass}>
          <h1 className={authTitleClass}>Welcome back</h1>
          <p className={authSubtitleClass}>Sign in to access your wallet and recent activity.</p>

          <form className={authFormStackClass} onSubmit={handleLogin}>
            {errorMsg ? (
              <div className={authErrorBoxClass} role="alert">
                {errorMsg}
              </div>
            ) : null}
            <div>
              <label htmlFor="login-email" className={authLabelClass}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                className={`${authInputClass} mt-2`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className={authLabelClass}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter password"
                className={`${authInputClass} mt-2`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Link href="/forgot-password" className={authLinkClass}>
                Forgot password?
              </Link>
            </div>
            <button type="submit" className={authPrimaryBtnClass}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
