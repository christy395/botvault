"use client";

import { useEffect, useState } from "react";

type Bot = {
  id: string;
  name: string;
  runtime: string;
  status: string;
  connection_status?: string;
  connectionStatus?: string;
  discord_username?: string | null;
  discord_bot_id?: string | null;
  created_at?: string;
};

export default function BotProfile({ params }: { params: Promise<{ id: string }> }) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { id } = await params;
      const response = await fetch(`/api/bots/${encodeURIComponent(id)}`);
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        setError(data.error || "Could not load this bot.");
        return;
      }

      setBot(data.bot);
    })();
  }, [params]);

  if (error) {
    return (
      <main className="dashboardPage">
        <nav className="nav">
          <a className="brand" href="/dashboard">BOT<span>VAULT</span></a>
        </nav>
        <section className="dashboardShell">
          <div className="dashboardNotice"><span>!</span>{error}</div>
          <a className="secondary" href="/dashboard">← Back to dashboard</a>
        </section>
      </main>
    );
  }

  if (!bot) {
    return (
      <main className="dashboardPage">
        <nav className="nav"><a className="brand" href="/dashboard">BOT<span>VAULT</span></a></nav>
        <section className="dashboardShell"><div className="card botProfileLoading">Loading bot...</div></section>
      </main>
    );
  }

  const connected = (bot.connection_status || bot.connectionStatus) === "connected";

  return (
    <main className="dashboardPage">
      <nav className="nav">
        <a className="brand" href="/dashboard">BOT<span>VAULT</span></a>
        <div className="dashboardNav">
          <a href="/dashboard">My Bots</a>
          <a href="/dashboard/commands">Commands</a>
        </div>
      </nav>

      <section className="dashboardShell botProfileShell">
        <a className="backLink" href="/dashboard">← Back to My Bots</a>

        <div className="botProfileHero card">
          <div>
            <span className="dashboardLabel">BOT PROFILE</span>
            <h1>{bot.name}</h1>
            <p>This page contains only this bot. Other bots in your account are not shown here.</p>
          </div>
          <span className={connected ? "statusBadge liveStatus" : "statusBadge pending"}>
            <i /> {connected ? "Discord connected" : "Not connected"}
          </span>
        </div>

        <div className="botProfileGrid">
          <section className="card botInfoCard">
            <span className="dashboardLabel">DISCORD ACCOUNT</span>
            <h2>{bot.discord_username || "Discord bot"}</h2>
            <div className="infoRows">
              <div><span>Discord bot ID</span><b>{bot.discord_bot_id || "—"}</b></div>
              <div><span>Connection</span><b>{connected ? "Connected" : "Not connected"}</b></div>
              <div><span>Token</span><b>Encrypted & hidden</b></div>
            </div>
          </section>

          <section className="card botInfoCard">
            <span className="dashboardLabel">HOSTING</span>
            <h2>{bot.runtime === "node" ? "Node.js" : "Python"}</h2>
            <div className="infoRows">
              <div><span>Process</span><b>{bot.status}</b></div>
              <div><span>Hosting node</span><b>Not connected</b></div>
              <div><span>24/7 runtime</span><b>Waiting for VPS</b></div>
            </div>
          </section>
        </div>

        <section className="card botSecurityNote">
          <strong>🔒 Token protection</strong>
          <p>Your Discord token is never displayed on this page or returned by the normal bot API. BotVault stores it encrypted for the future hosting controller.</p>
        </section>
      </section>
    </main>
  );
}
