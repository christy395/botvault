"use client";

import { useState } from "react";

const features = [
  ["Private Bot Profiles", "Keep each bot's settings and account records scoped to your account."],
  ["Discord Token Validation", "Validate a bot token with Discord before saving its encrypted credential."],
  ["Python + Node Selection", "Choose a runtime profile for your bot while hosting-node support is configured."],
  ["Command Builder", "Configure simple prefix commands for bots connected to the BotVault runner."],
  ["Server-Side Secrets", "Keep bot tokens and runner credentials out of the browser and public responses."],
  ["Process Controls", "Start, stop, restart, and refresh a bot from its individual control panel."]
];

export default function Home() {
  const [menu, setMenu] = useState(false);

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="/">BOT<span>VAULT</span></a>
        <button className="mobileMenu" onClick={() => setMenu(!menu)} aria-label="Toggle menu">☰</button>
        <div className={menu ? "navLinks open" : "navLinks"}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#status">Status</a>
          <a href="#faq">FAQ</a>
          <a className="navButton" href="/dashboard">Dashboard</a>
        </div>
      </nav>

      <section className="hero">
        <div className="glow glowOne" />
        <div className="glow glowTwo" />
        <div className="eyebrow"><span /> FREE FOREVER DISCORD HOSTING</div>
        <h1>Your Discord Bots.<br /><em>Online. 24/7.</em></h1>
        <p>Deploy and manage your Discord bots from a fast, secure control panel built for real hosting infrastructure.</p>
        <div className="heroActions">
          <a className="primary" href="/dashboard">Start Hosting <b>→</b></a>
          <a className="secondary" href="#features">Explore Features</a>
        </div>
        <div className="heroPanel">
          <div className="panelTop"><span>BOTVAULT / OVERVIEW</span><span className="live"><i /> CONTROL PANEL</span></div>
          <div className="panelGrid">
            <div><small>ACTIVE BOTS</small><strong>—</strong><span>Connected infrastructure required</span></div>
            <div><small>HOSTING</small><strong>FREE</strong><span>Forever plan</span></div>
            <div><small>RUNTIME</small><strong>NODE + PY</strong><span>Container-based workers</span></div>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="sectionHead"><span>01 / FEATURES</span><h2>Everything you need to run your bots.</h2></div>
        <div className="featureGrid">
          {features.map(([title, text]) => <article className="card" key={title}><div className="icon">✦</div><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section id="pricing" className="pricing section">
        <div className="sectionHead"><span>02 / PRICING</span><h2>Free means free.</h2></div>
        <article className="priceCard">
          <div><span className="pill">FREE FOREVER</span><h3>Starter</h3><p>Everything required to begin hosting on the available BotVault node capacity.</p></div>
          <div className="price">₹0 <small>/ forever</small></div>
          <ul><li>Free account and bot profiles</li><li>Limits depend on connected node capacity</li><li>Python and Node runtime selection</li><li>Bot controls and command builder</li><li>Encrypted token storage</li></ul>
          <a className="primary" href="/dashboard">Create Your Bot <b>→</b></a>
        </article>
      </section>

      <section id="status" className="section statusSection">
        <div className="sectionHead"><span>03 / STATUS</span><h2>Infrastructure health.</h2></div>
        <div className="statusCard">
          <div><span className="statusDot" /> Website <b>Operational</b></div>
          <div><span className="statusDot pending" /> API <b>Awaiting deployment</b></div>
          <div><span className="statusDot pending" /> Hosting nodes <b>Awaiting node connection</b></div>
        </div>
      </section>

      <section id="faq" className="section faq">
        <div className="sectionHead"><span>04 / FAQ</span><h2>Questions, answered.</h2></div>
        <details><summary>Is BotVault really free?</summary><p>The application is designed around a ₹0/$0 Free Forever plan. Actual capacity depends on the hosting nodes connected to the platform.</p></details>
        <details><summary>Where do my Discord bots run?</summary><p>The website is the control panel. A separately configured Linux hosting runner must be online to keep a bot connected. The current runner supports Discord gateway connections and configured simple commands; arbitrary project-file uploads and isolated per-user containers are not enabled yet.</p></details>
        <details><summary>Are Discord tokens protected?</summary><p>BotVault encrypts stored tokens in the web database and does not return them in normal bot API responses. The runner currently keeps reconnect state in a private local JSON file, so the VPS filesystem must be restricted; encrypted runner-side persistence is still a production-hardening task.</p></details>
      </section>

      <footer><div className="brand">BOT<span>VAULT</span></div><p>Free Discord Bot Hosting. Forever.</p><span>© 2026 BotVault</span></footer>
    </main>
  );
}
