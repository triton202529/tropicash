import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (!newPassword || !confirmPassword) {
      setErrorMsg("Please enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setSuccessMsg("Password updated successfully. Redirecting...");
    setLoading(false);
    setTimeout(() => {
      router.push("/auth");
    }, 1500);
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
          <h1 className={authTitleClass}>Reset your password</h1>
          <p className={authSubtitleClass}>
            Choose a strong password you haven&apos;t used elsewhere. You&apos;ll be signed in on the next step.
          </p>

          <form className={authFormStackClass} onSubmit={handleReset}>
            <div>
              <label htmlFor="new-password" className={authLabelClass}>
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className={`${authInputClass} mt-2`}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className={authLabelClass}>
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
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
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
