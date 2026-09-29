"use client";

import { useEffect, useState } from "react";

type Bot = { id: string; name: string; runtime: string; status: string };

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("Loading your account...");
  const [busy, setBusy] = useState(false);

  async function load() {
    const me = await fetch("/api/auth/me");
    if (!me.ok) { window.location.href = "/login"; return; }
    const user = await me.json();
    setEmail(user.user?.email || "");
    const response = await fetch("/api/bots");
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "Unable to load bots."); return; }
    setBots(data.bots || []);
    setNotice("");
  }

  useEffect(() => { load(); }, []);

  async function createBot() {
    const name = window.prompt("Bot name");
    if (!name?.trim()) return;
    setBusy(true);
    const response = await fetch("/api/bots", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ name: name.trim(), runtime: "python" })
    });
    const data = await response.json();
    if (!response.ok) setNotice(data.error || "Could not create bot.");
    else { setBots(current => [data.bot, ...current]); setNotice("Bot saved to your BotVault account."); }
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="dashboardPage">
      <nav className="nav">
        <a className="brand" href="/">BOT<span>VAULT</span></a>
        <div className="dashboardNav">
          <a href="/">Home</a><a href="/dashboard/commands">Commands</a>
          <span className="dashboardUser">{email || "Account"}</span>
          <button className="secondary smallButton" onClick={logout}>Log out</button>
        </div>
      </nav>

      <section className="dashboardShell">
        <div className="dashboardHeader">
          <div>
            <span className="eyebrow dashboardEyebrow"><span /> CONTROL PANEL</span>
            <h1>BotVault Dashboard</h1>
            <p>Your bots are stored against your BotVault account, so leaving the site does not delete them.</p>
          </div>
          <button className="primary" onClick={createBot} disabled={busy}>Create Bot <b>→</b></button>
        </div>

        {notice && <div className="dashboardNotice" role="status"><span>!</span>{notice}</div>}

        <div className="dashboardStats">
          <article className="dashboardStat card"><small>YOUR BOTS</small><strong>{bots.length}</strong><span>Stored in Cloudflare D1</span></article>
          <article className="dashboardStat card"><small>PLAN</small><strong>FREE</strong><span>Free Forever</span></article>
          <article className="dashboardStat card"><small>RUNTIME</small><strong>NODE + PY</strong><span>Node.js and Python</span></article>
          <article className="dashboardStat card"><small>ACCOUNT</small><strong>SECURE</strong><span>Persistent session</span></article>
        </div>

        <div className="dashboardGrid">
          <section className="dashboardCard card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">BOTS</span><h2>Your bots</h2></div>
              <button className="secondary smallButton" onClick={createBot}>+ New bot</button>
            </div>
            {bots.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon">✦</div><h3>No bots yet</h3>
                <p>Create your first bot. It will remain linked to your account when you leave and return later.</p>
                <button className="primary" onClick={createBot}>Create your first bot</button>
              </div>
            ) : (
              <div className="botRows">
                {bots.map(bot => (
                  <div className="botRow" key={bot.id}>
                    <div className="commandIcon">✦</div>
                    <div><strong>{bot.name}</strong><small>{bot.runtime.toUpperCase()} · {bot.status.toUpperCase()}</small></div>
                    <span className={bot.status === "running" ? "statusBadge liveStatus" : "statusBadge pending"}><i /> {bot.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboardCard card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">PERSISTENCE</span><h2>Account storage</h2></div>
              <span className="statusBadge liveStatus"><i /> Connected</span>
            </div>
            <div className="healthList">
              <div><span className="healthDot liveDot" /> Account <b>Saved</b></div>
              <div><span className="healthDot liveDot" /> Bot records <b>Saved</b></div>
              <div><span className="healthDot liveDot" /> Sessions <b>30 days</b></div>
              <div><span className="healthDot pendingDot" /> Bot runtime <b>Needs VPS</b></div>
            </div>
          </section>

          <section className="dashboardCard card wideCard">
            <div className="dashboardCardHead"><div><span className="dashboardLabel">ACTIVITY</span><h2>Recent deployments</h2></div></div>
            <div className="emptyActivity"><span>Deployment history will appear here.</span><small>Persistent bot records are now ready; the VPS/node connection will handle actual long-running Discord processes.</small></div>
          </section>
        </div>

        <section className="dashboardHelp card">
          <div><span className="dashboardLabel">NEXT STEP</span><h2>Connect your hosting node.</h2><p>Cloudflare D1 now stores account and bot records. Your VPS will run the actual Discord bot processes; Cloudflare remains the website/API layer.</p></div>
          <div className="dashboardActions"><a className="secondary" href="/dashboard/commands">Command Builder</a><button className="secondary" onClick={logout}>Log out</button></div>
        </section>
      </section>
    </main>
  );
}
