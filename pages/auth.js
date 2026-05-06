import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import {
  authCardClass,
  authErrorBoxClass,
  authFooterMutedClass,
  authFormStackClass,
  authInlineToggleClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPageShellClass,
  authPrimaryBtnClass,
  authSubtitleClass,
  authTitleClass,
  authTopRowClass,
} from "../lib/authFormUi";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/wallet");
  };

  return (
    <>
      <Navbar />
      <div className={authPageShellClass}>
        <div className={authTopRowClass}>
          <Link href="/" className={authLinkClass}>
            ← Back to home
          </Link>
        </div>
        <div className={authCardClass}>
          <h1 className={authTitleClass}>
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className={authSubtitleClass}>
            {isSignUp
              ? "Create your wallet and start moving money securely across the Caribbean."
              : "Sign in to access your wallet and recent activity."}
          </p>

          <form className={authFormStackClass} onSubmit={handleAuth}>
            {error ? (
              <div className={authErrorBoxClass} role="alert">
                {error}
              </div>
            ) : null}
            <div>
              <label htmlFor="auth-email" className={authLabelClass}>
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                className={`${authInputClass} mt-2`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="auth-password" className={authLabelClass}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                placeholder="Enter password"
                className={`${authInputClass} mt-2`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isSignUp ? (
              <div>
                <Link href="/forgot-password" className={authLinkClass}>
                  Forgot password?
                </Link>
              </div>
            ) : null}

            <button type="submit" className={authPrimaryBtnClass} disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <p className={authFooterMutedClass}>
            {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className={authInlineToggleClass}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
