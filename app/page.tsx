"use client";

import { useState } from "react";

const features = [
  ["24/7 Hosting", "Run supported Discord bots continuously on isolated hosting nodes."],
  ["Node.js + Python", "Deploy bots using the runtimes your project actually needs."],
  ["Live Console", "Follow deployment and runtime logs from the BotVault dashboard."],
  ["File Manager", "Manage bot files without exposing the host filesystem."],
  ["Environment Secrets", "Keep Discord tokens and application secrets out of the UI and logs."],
  ["Resource Monitoring", "Track CPU, memory, storage and uptime from the control panel."]
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
          <div className="panelTop"><span>BOTVAULT / OVERVIEW</span><span className="live"><i /> LIVE</span></div>
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
          <ul><li>Configurable bot limit</li><li>Configurable RAM and storage</li><li>Node.js and Python</li><li>Dashboard and console</li><li>File and environment management</li></ul>
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
        <details><summary>Can Cloudflare run my Discord bot?</summary><p>Cloudflare hosts the web application and API edge. Long-running Discord bot processes belong on dedicated hosting nodes, typically isolated with Docker.</p></details>
        <details><summary>Are Discord tokens protected?</summary><p>The production architecture requires tokens to remain server-side and protected. They must never be placed in public URLs, browser logs, analytics, or normal API responses.</p></details>
      </section>

      <footer><div className="brand">BOT<span>VAULT</span></div><p>Free Discord Bot Hosting. Forever.</p><span>© 2026 BotVault</span></footer>
    </main>
  );
}
