"use client";

import { useState } from "react";

const stats = [
  { label: "Active bots", value: "0", note: "No bots deployed yet" },
  { label: "Plan", value: "FREE", note: "Free Forever" },
  { label: "Runtime", value: "NODE + PY", note: "Node.js and Python" },
  { label: "Infrastructure", value: "OFFLINE", note: "Connect a hosting node" },
];

export default function Dashboard() {
  const [notice, setNotice] = useState("");

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  return (
    <main className="dashboardPage">
      <nav className="nav">
        <a className="brand" href="/">BOT<span>VAULT</span></a>
        <div className="dashboardNav">
          <a href="/">Home</a>
          <span className="dashboardUser">Free Forever</span>
        </div>
      </nav>

      <section className="dashboardShell">
        <div className="dashboardHeader">
          <div>
            <span className="eyebrow dashboardEyebrow"><span /> CONTROL PANEL</span>
            <h1>BotVault Dashboard</h1>
            <p>Manage your Discord bots, deployments, files and runtime infrastructure from one place.</p>
          </div>
          <button
            className="primary"
            onClick={() => showNotice("A hosting node must be connected before a bot can be deployed.")}
          >
            Create Bot <b>→</b>
          </button>
        </div>

        {notice && (
          <div className="dashboardNotice" role="status">
            <span>!</span>
            {notice}
          </div>
        )}

        <div className="dashboardStats">
          {stats.map((stat) => (
            <article className="dashboardStat card" key={stat.label}>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
              <span>{stat.note}</span>
            </article>
          ))}
        </div>

        <div className="dashboardGrid">
          <section className="dashboardCard card">
            <div className="dashboardCardHead">
              <div>
                <span className="dashboardLabel">BOTS</span>
                <h2>Your bots</h2>
              </div>
              <button className="secondary smallButton" onClick={() => showNotice("Bot creation is waiting for hosting infrastructure.")}>
                + New bot
              </button>
            </div>

            <div className="emptyState">
              <div className="emptyIcon">✦</div>
              <h3>No bots yet</h3>
              <p>Connect a BotVault hosting node first. Once infrastructure is online, deployed bots will appear here with live status, CPU, memory and uptime.</p>
              <button className="primary" onClick={() => showNotice("Node connection is the next setup step.")}>
                Set up infrastructure
              </button>
            </div>
          </section>

          <section className="dashboardCard card">
            <div className="dashboardCardHead">
              <div>
                <span className="dashboardLabel">STATUS</span>
                <h2>Infrastructure</h2>
              </div>
              <span className="statusBadge pending"><i /> Awaiting node</span>
            </div>

            <div className="healthList">
              <div><span className="healthDot liveDot" /> Website <b>Operational</b></div>
              <div><span className="healthDot pendingDot" /> API <b>Awaiting deployment</b></div>
              <div><span className="healthDot pendingDot" /> Hosting nodes <b>Awaiting connection</b></div>
              <div><span className="healthDot pendingDot" /> Runtime workers <b>Awaiting node</b></div>
            </div>
          </section>

          <section className="dashboardCard card wideCard">
            <div className="dashboardCardHead">
              <div>
                <span className="dashboardLabel">ACTIVITY</span>
                <h2>Recent deployments</h2>
              </div>
            </div>

            <div className="emptyActivity">
              <span>No deployment activity yet.</span>
              <small>Deployments will appear here when a hosting node is connected.</small>
            </div>
          </section>
        </div>

        <section className="dashboardHelp card">
          <div>
            <span className="dashboardLabel">NEXT STEP</span>
            <h2>Connect your first hosting node.</h2>
            <p>Cloudflare hosts the BotVault website and edge layer. Long-running Discord bots need a separate hosting machine or node running the BotVault controller and isolated bot containers.</p>
          </div>
          <a className="secondary" href="/">Back to BotVault</a>
        </section>
      </section>
    </main>
  );
}
