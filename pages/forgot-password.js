import { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
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
  authSuccessBoxClass,
  authTitleClass,
  authTopRowClass,
} from "../lib/authFormUi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendReset = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setSuccessMsg("Password reset link sent. Check your email.");
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <div className={authPageShellClass}>
        <div className={`${authTopRowClass} justify-between`}>
          <Link href="/" className={authLinkClass}>
            ← Back to home
          </Link>
          <Link href="/auth" className={authLinkClass}>
            Back to login
          </Link>
        </div>
        <div className={authCardClass}>
          <h1 className={authTitleClass}>Forgot your password?</h1>
          <p className={authSubtitleClass}>
            Enter the email on your account and we&apos;ll send a secure link to reset your password.
          </p>

          <form className={authFormStackClass} onSubmit={handleSendReset}>
            <div>
              <label htmlFor="forgot-email" className={authLabelClass}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${authInputClass} mt-2`}
              />
            </div>

            {errorMsg ? (
              <div className={authErrorBoxClass} role="alert">
                {errorMsg}
              </div>
            ) : null}
            {successMsg ? (
              <div className={authSuccessBoxClass} role="status">
                {successMsg}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className={authPrimaryBtnClass}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
