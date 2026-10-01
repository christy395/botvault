"use client";

import { useEffect, useState } from "react";

type Bot = {
  id: string;
  name: string;
  runtime: string;
  status: string;
  connection_status?: string;
  discord_username?: string | null;
  discord_bot_id?: string | null;
};

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNewBot, setShowNewBot] = useState(false);
  const [botName, setBotName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (!me.ok) {
      window.location.href = "/login";
      return;
    }

    const user = await me.json();
    setEmail(user.user?.email || "");

    const response = await fetch("/api/bots");
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "Unable to load bots.");
      return;
    }

    setBots(data.bots || []);
  }

  useEffect(() => {
    load();
  }, []);

  function openNewBot() {
    setFormError("");
    setBotName("");
    setBotToken("");
    setShowToken(false);
    setShowNewBot(true);
  }

  function closeNewBot() {
    if (busy) return;
    setShowNewBot(false);
  }

  async function createBot() {
    setFormError("");

    if (!botName.trim()) {
      setFormError("Enter a name for this bot.");
      return;
    }

    if (!botToken.trim()) {
      setFormError("Paste the Discord bot token.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: botName.trim(),
          token: botToken.trim(),
          runtime: "python"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || "Could not connect the Discord bot.");
        return;
      }

      setBots(current => [data.bot, ...current]);
      setNotice(`${data.bot.discordUsername || data.bot.name} is connected to BotVault. The token is hidden and encrypted.`);
      setShowNewBot(false);
      setBotName("");
      setBotToken("");
    } catch {
      setFormError("Could not reach BotVault. Try again.");
    } finally {
      setBusy(false);
    }
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
          <a href="/">Home</a>
          <a href="/dashboard/commands">Commands</a>
          <span className="dashboardUser">{email || "Account"}</span>
          <button className="secondary smallButton" onClick={logout}>Log out</button>
        </div>
      </nav>

      <section className="dashboardShell">
        <div className="dashboardHeader">
          <div>
            <span className="eyebrow dashboardEyebrow"><span /> CONTROL PANEL</span>
            <h1>BotVault Dashboard</h1>
            <p>Connect your own Discord bots one at a time. Each bot gets its own private profile.</p>
          </div>
          <button className="primary" onClick={openNewBot}>Create Bot <b>→</b></button>
        </div>

        {notice && (
          <div className="dashboardNotice dashboardSuccess" role="status">
            <span>✓</span>{notice}
          </div>
        )}

        <div className="dashboardStats">
          <article className="dashboardStat card">
            <small>YOUR BOTS</small>
            <strong>{bots.length}</strong>
            <span>Private to your account</span>
          </article>
          <article className="dashboardStat card">
            <small>PLAN</small>
            <strong>FREE</strong>
            <span>Free Forever</span>
          </article>
          <article className="dashboardStat card">
            <small>RUNTIME</small>
            <strong>NODE + PY</strong>
            <span>Node.js and Python</span>
          </article>
          <article className="dashboardStat card">
            <small>SECURITY</small>
            <strong>ENCRYPTED</strong>
            <span>Token hidden from UI</span>
          </article>
        </div>

        <div className="dashboardGrid">
          <section className="dashboardCard card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">MY BOTS</span><h2>Your bots</h2></div>
              <button className="secondary smallButton" onClick={openNewBot}>+ New bot</button>
            </div>

            {bots.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon">✦</div>
                <h3>No bots yet</h3>
                <p>Create a new bot and paste its Discord token. BotVault validates the token and keeps it hidden.</p>
                <button className="primary" onClick={openNewBot}>Connect your first bot</button>
              </div>
            ) : (
              <div className="botRows">
                {bots.map(bot => (
                  <div className="botRow" key={bot.id}>
                    <div className="commandIcon">✦</div>
                    <div>
                      <strong>{bot.name}</strong>
                      <small>{bot.discord_username || "Discord bot"} · {bot.runtime.toUpperCase()}</small>
                    </div>
                    <div className="botRowActions">
                      <span className={bot.connection_status === "connected" ? "statusBadge liveStatus" : "statusBadge pending"}>
                        <i /> {bot.connection_status === "connected" ? "Connected" : "Not connected"}
                      </span>
                      <a className="secondary tinyButton" href={`/dashboard/bots/${encodeURIComponent(bot.id)}`}>Open</a>
                    </div>
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
              <div><span className="healthDot liveDot" /> Discord tokens <b>Encrypted</b></div>
              <div><span className="healthDot pendingDot" /> Bot runtime <b>Needs VPS</b></div>
            </div>
          </section>

          <section className="dashboardCard card wideCard">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">ACTIVITY</span><h2>Recent deployments</h2></div>
            </div>
            <div className="emptyActivity">
              <span>Deployment history will appear here.</span>
              <small>Actual 24/7 process hosting will start when a real hosting node is connected.</small>
            </div>
          </section>
        </div>

        <section className="dashboardHelp card">
          <div>
            <span className="dashboardLabel">BOT PROFILES</span>
            <h2>One profile per bot.</h2>
            <p>Opening a bot only shows that bot. Other bots in your account are not displayed inside its profile.</p>
          </div>
          <div className="dashboardActions">
            <a className="secondary" href="/dashboard/commands">Command Builder</a>
            <button className="secondary" onClick={logout}>Log out</button>
          </div>
        </section>
      </section>

      {showNewBot && (
        <div className="modalBackdrop" role="presentation" onMouseDown={closeNewBot}>
          <section className="newBotModal" role="dialog" aria-modal="true" aria-labelledby="new-bot-title" onMouseDown={event => event.stopPropagation()}>
            <button className="modalClose" onClick={closeNewBot} aria-label="Close">×</button>

            <span className="dashboardLabel">NEW BOT</span>
            <h2 id="new-bot-title">Connect your Discord bot</h2>
            <p className="modalIntro">
              Create a Discord application in the Developer Portal, copy its bot token, and paste it below.
              BotVault validates the token and stores it encrypted.
            </p>

            <div className="newBotSteps">
              <div><b>1</b><span>Open the Discord Developer Portal and create your application.</span></div>
              <div><b>2</b><span>Open the <strong>Bot</strong> tab and copy/reset the bot token.</span></div>
              <div><b>3</b><span>Paste it here. The token will never be shown again in your BotVault profile.</span></div>
            </div>

            <label className="modalField">
              Bot name <span>(for your reference)</span>
              <input
                value={botName}
                onChange={event => setBotName(event.target.value)}
                placeholder="My Support Bot"
                maxLength={80}
                autoComplete="off"
              />
            </label>

            <label className="modalField">
              Bot token
              <div className="tokenInputWrap">
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={event => setBotToken(event.target.value)}
                  placeholder="MTA1..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="tokenToggle" onClick={() => setShowToken(value => !value)}>
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {formError && <div className="modalError"><span>!</span>{formError}</div>}

            <button className="primary modalCreateButton" onClick={createBot} disabled={busy}>
              {busy ? "Connecting..." : "Connect bot"}
            </button>

            <p className="modalSecurity">🔒 Your token is sent over HTTPS, validated with Discord, encrypted at rest, and never returned by the BotVault API.</p>
          </section>
        </div>
      )}
    </main>
  );
}
