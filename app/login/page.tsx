"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("verified");
    if (status === "success") setNotice("Email verified! You can now sign in.");
    else if (status === "expired") setError("That verification link expired. Sign in with your email and request a new link.");
    else if (status === "invalid") setError("That verification link is invalid.");
    else if (status === "error") setError("We couldn't verify your email right now. Please try again.");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setNeedsVerification(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setNeedsVerification(Boolean(data.verificationRequired));
        setBusy(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Could not connect to BotVault. Please try again.");
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not resend the verification email.");
      else setNotice(data.message || "If the account needs verification, an email will be sent.");
    } catch {
      setError("Could not connect to BotVault. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return <main className="authPage"><div className="authCard card">
    <a className="brand" href="/">BOT<span>VAULT</span></a>
    <span className="eyebrow dashboardEyebrow"><span /> ACCOUNT</span>
    <h1>Welcome back</h1><p>Sign in to access your saved bots and dashboard.</p>
    <form onSubmit={submit} className="authForm">
      <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <div className="dashboardNotice"><span>!</span>{error}</div>}
      {notice && <div className="dashboardNotice"><span>✓</span>{notice}</div>}
      <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"} <b>→</b></button>
    </form>
    {needsVerification && <button type="button" className="primary" onClick={resend} disabled={resending || !email.trim()}>{resending ? "Sending..." : "Resend verification email"}</button>}
    <p className="authSwitch">New to BotVault? <a href="/register">Create an account</a></p>
  </div></main>;
}
