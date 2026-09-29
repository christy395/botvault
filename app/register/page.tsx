"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const res = await fetch("/api/auth/register", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({email,password}) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Registration failed."); setBusy(false); return; }
    router.push("/dashboard");
  }

  return <main className="authPage"><div className="authCard card">
    <a className="brand" href="/">BOT<span>VAULT</span></a>
    <span className="eyebrow dashboardEyebrow"><span /> CREATE ACCOUNT</span>
    <h1>Create your account</h1><p>Your bots will be linked to your account and remain available when you come back.</p>
    <form onSubmit={submit} className="authForm">
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <div className="dashboardNotice"><span>!</span>{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Creating..." : "Create account"} <b>→</b></button>
    </form>
    <p className="authSwitch">Already have an account? <a href="/login">Sign in</a></p>
  </div></main>;
}
