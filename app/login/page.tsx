"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({email,password}) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Login failed."); setBusy(false); return; }
    router.push("/dashboard");
  }

  return <main className="authPage"><div className="authCard card">
    <a className="brand" href="/">BOT<span>VAULT</span></a>
    <span className="eyebrow dashboardEyebrow"><span /> ACCOUNT</span>
    <h1>Welcome back</h1><p>Sign in to access your saved bots and dashboard.</p>
    <form onSubmit={submit} className="authForm">
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <div className="dashboardNotice"><span>!</span>{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"} <b>→</b></button>
    </form>
    <p className="authSwitch">New to BotVault? <a href="/register">Create an account</a></p>
  </div></main>;
}
