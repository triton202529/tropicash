import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";

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
      <div style={pageShell}>
        <div style={backRow}>
          <Link href="/" style={backToHome}>
            ← Back to Home
          </Link>
        </div>
        <div style={card}>
          <h1 style={title}>{isSignUp ? "Create Account" : "Login to Tropicash"}</h1>

          {error ? <p style={errorText}>{error}</p> : null}

          <form onSubmit={handleAuth}>
            <label htmlFor="auth-email" style={label}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="auth-password" style={{ ...label, marginTop: "0.85rem" }}>
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="Enter password"
              style={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {!isSignUp ? (
              <div style={{ marginTop: "0.7rem" }}>
                <Link href="/forgot-password" style={linkText}>
                  Forgot password?
                </Link>
              </div>
            ) : null}

            <button type="submit" style={primaryBtn} disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <p style={footerText}>
            {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={inlineBtn}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}

const pageShell = {
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "1.25rem",
  boxSizing: "border-box",
};

const backRow = {
  width: "100%",
  maxWidth: "430px",
  marginBottom: "0.65rem",
};

const backToHome = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#7dd3fc",
  textDecoration: "none",
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
  textAlign: "center",
  color: "#0f172a",
  fontSize: "1.45rem",
  fontWeight: 700,
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
  marginTop: "1rem",
  border: "1px solid rgba(59, 130, 246, 0.6)",
  borderRadius: "10px",
  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "0.95rem",
  padding: "0.72rem 0.8rem",
  cursor: "pointer",
};

const footerText = {
  margin: "0.9rem 0 0",
  textAlign: "center",
  color: "#475569",
  fontSize: "0.9rem",
};

const inlineBtn = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  textDecoration: "underline",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const linkText = {
  color: "#2563eb",
  textDecoration: "none",
  fontSize: "0.88rem",
  fontWeight: 600,
};

const errorText = {
  margin: "0.8rem 0",
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  padding: "0.6rem 0.7rem",
  fontSize: "0.88rem",
};
