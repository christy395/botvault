"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setBusy(false);
        return;
      }

      setNotice(data.message || "Check your inbox for a verification link before signing in.");
      setBusy(false);
    } catch {
      setError("Could not connect to BotVault. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <div className="authCard card">
        <a className="brand" href="/">BOT<span>VAULT</span></a>
        <span className="eyebrow dashboardEyebrow"><span /> CREATE ACCOUNT</span>
        <h1>Create your account</h1>
        <p>Verify your email to protect your BotVault account and access your dashboard.</p>

        <form onSubmit={submit} className="authForm">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <div className="dashboardNotice"><span>!</span>{error}</div>}
          {notice && <div className="dashboardNotice"><span>✓</span>{notice} <a href="/login">Go to sign in</a></div>}
          <button className="primary" disabled={busy}>{busy ? "Creating..." : "Create account"} <b>→</b></button>
        </form>
        <p className="authSwitch">Already have an account? <a href="/login">Sign in</a></p>
      </div>
    </main>
  );
}
