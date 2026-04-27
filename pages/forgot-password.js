import { useState } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";

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
      <div style={pageShell}>
        <div style={card}>
          <h1 style={title}>Forgot Password</h1>
          <p style={subtitle}>Enter your email and we will send a reset link.</p>

          <form onSubmit={handleSendReset}>
            <label htmlFor="forgot-email" style={label}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />

            {errorMsg ? <p style={errorText}>{errorMsg}</p> : null}
            {successMsg ? <p style={successText}>{successMsg}</p> : null}

            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const pageShell = {
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "1.25rem",
  boxSizing: "border-box",
};

const card = {
  width: "100%",
  maxWidth: "430px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.12)",
  padding: "1.35rem 1.2rem",
};

const title = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.45rem",
  fontWeight: 700,
};

const subtitle = {
  margin: "0.45rem 0 0.9rem",
  color: "#475569",
  fontSize: "0.9rem",
};

const label = {
  display: "block",
  color: "#334155",
  fontSize: "0.85rem",
  fontWeight: 600,
  marginBottom: "0.3rem",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "0.72rem 0.8rem",
  fontSize: "0.95rem",
  color: "#0f172a",
  background: "#f8fafc",
};

const primaryBtn = {
  width: "100%",
  marginTop: "0.9rem",
  border: "1px solid rgba(59, 130, 246, 0.6)",
  borderRadius: "10px",
  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "0.95rem",
  padding: "0.72rem 0.8rem",
  cursor: "pointer",
};

const errorText = {
  margin: "0.8rem 0 0",
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  padding: "0.6rem 0.7rem",
  fontSize: "0.88rem",
};

const successText = {
  margin: "0.8rem 0 0",
  color: "#065f46",
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  borderRadius: "10px",
  padding: "0.6rem 0.7rem",
  fontSize: "0.88rem",
};
