"use client";

import { useCallback, useEffect, useState } from "react";

type RuntimeStatus = {
  botId: string;
  running: boolean;
  ready: boolean;
  uptime: number;
  latencyMs: number | null;
  guilds: number;
  members: number;
  commandsUsed: number;
  lastError: string | null;
};

type ConsoleLog = { time: string; level: "INFO" | "WARN" | "ERROR"; message: string };
type NodeStats = {
  scope: "host";
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  memoryPercent: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  diskPercent: number | null;
};

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
  updated_at?: string;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

export default function BotProfile({ params }: { params: Promise<{ id: string }> }) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [logsError, setLogsError] = useState("");
  const [nodeStats, setNodeStats] = useState<NodeStats | null>(null);
  const [nodeStatsError, setNodeStatsError] = useState("");
  const [botId, setBotId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadBot = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch(`/api/bots/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data.error || "Could not load this bot.");
        return;
      }
      setError("");
      setBot(data.bot);
      try {
        const runtimeResponse = await fetch(`/api/bots/${encodeURIComponent(id)}/runtime`, { cache: "no-store" });
        const runtimeData = await runtimeResponse.json();
        if (runtimeResponse.ok && runtimeData.runtime) {
          setRuntimeInfo(runtimeData.runtime);
          setRuntimeError("");
        } else {
          setRuntimeInfo(null);
          setRuntimeError(runtimeData.error || "Hosting runner is unavailable.");
        }
      } catch {
        setRuntimeInfo(null);
        setRuntimeError("Hosting runner is unavailable.");
      }
      try {
        const logsResponse = await fetch(`/api/bots/${encodeURIComponent(id)}/logs`, { cache: "no-store" });
        const logsData = await logsResponse.json();
        if (logsResponse.ok && Array.isArray(logsData.logs)) {
          setConsoleLogs(logsData.logs);
          setLogsError("");
        } else {
          setLogsError(logsData.error || "Console logs are unavailable.");
        }
      } catch {
        setLogsError("Console logs are unavailable.");
      }
      try {
        const nodeResponse = await fetch(`/api/bots/${encodeURIComponent(id)}/node`, { cache: "no-store" });
        const nodeData = await nodeResponse.json();
        if (nodeResponse.ok && nodeData.stats) {
          setNodeStats(nodeData.stats);
          setNodeStatsError("");
        } else {
          setNodeStats(null);
          setNodeStatsError(nodeData.error || "Node metrics are unavailable.");
        }
      } catch {
        setNodeStats(null);
        setNodeStatsError("Node metrics are unavailable.");
      }
    } catch {
      if (!quiet) setError("Could not reach BotVault. Check your connection and try again.");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (cancelled) return;
      setBotId(id);
      void loadBot(id);
    });
    return () => { cancelled = true; };
  }, [params, loadBot]);

  useEffect(() => {
    if (!botId) return;
    const timer = window.setInterval(() => void loadBot(botId, true), 10000);
    return () => window.clearInterval(timer);
  }, [botId, loadBot]);

  async function runAction(action: "start" | "stop" | "restart") {
    if (!botId || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/bots/${encodeURIComponent(botId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || `Could not ${action} this bot.`);
        return;
      }
      setNotice(action === "start" ? "Start request accepted by the hosting runner."
        : action === "stop" ? "Stop request accepted by the hosting runner."
        : "Restart request accepted by the hosting runner.");
      await loadBot(botId, true);
    } catch {
      setError("Could not reach the hosting runner. Check that a VPS is connected and configured.");
    } finally {
      setBusy(false);
    }
  }

  const running = runtimeInfo ? runtimeInfo.running : bot?.status === "running";
  const connected = runtimeInfo ? runtimeInfo.ready : (bot?.connection_status || bot?.connectionStatus) === "connected";
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (error && !bot) {
    return (
      <main className="dashboardPage">
        <nav className="nav"><a className="brand" href="/dashboard">BOT<span>VAULT</span></a></nav>
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
        <section className="dashboardShell"><div className="card botProfileLoading">Loading bot profile…</div></section>
      </main>
    );
  }

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
            <span className="dashboardLabel">BOT PROFILE / CONTROL</span>
            <h1>{bot.name}</h1>
            <p>Manage this bot's connection and hosting state from one place.</p>
            <div className="profileMeta">ID: <code>{bot.id}</code></div>
          </div>
          <span className={running ? "statusBadge liveStatus" : "statusBadge pending"}>
            <i /> {running ? "Running" : bot.status === "starting" ? "Starting" : "Stopped"}
          </span>
        </div>

        {notice && <div className="dashboardNotice dashboardSuccess" role="status"><span>✓</span>{notice}</div>}
        {error && <div className="dashboardNotice" role="alert"><span>!</span>{error}</div>}

        <section className="card profileControls">
          <div>
            <span className="dashboardLabel">PROCESS CONTROL</span>
            <h2>Bot controls</h2>
            <p>Actions are sent securely to your configured BotVault hosting runner.</p>
          </div>
          <div className="profileControlButtons">
            <button className="primary" onClick={() => runAction("start")} disabled={busy || running}>
              {busy ? "Working…" : "▶ Start"}
            </button>
            <button className="secondary" onClick={() => runAction("restart")} disabled={busy || !running}>↻ Restart</button>
            <button className="secondary" onClick={() => runAction("stop")} disabled={busy || !running}>■ Stop</button>
            <button className="secondary" onClick={() => void loadBot(botId)} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </section>

        <section className="card commandBuilderShortcut">
          <div className="commandBuilderShortcutCopy">
            <span className="dashboardLabel">BOT CUSTOMIZATION</span>
            <h2>Build commands for {bot.name}</h2>
            <p>Create commands visually, generate a starter with AI, or open the code editor to write Python or JavaScript yourself.</p>
          </div>
          <div className="commandBuilderShortcutActions">
            <a className="primary" href={`/dashboard/commands?botId=${encodeURIComponent(bot.id)}`}>✦ Command Builder</a>
            <a className="secondary" href={`/dashboard/commands?botId=${encodeURIComponent(bot.id)}&mode=code`}>{"</>"} Build with Coding</a>
          </div>
        </section>

        <div className="profileMetricsGrid">
          <article className="card profileMetric"><span>LIVE PROCESS</span><strong>{runtimeInfo ? (running ? "Running" : "Stopped") : "Unavailable"}</strong><small>{runtimeError || "Live runner status, refreshed every 10 seconds"}</small></article>
          <article className="card profileMetric"><span>BOT UPTIME</span><strong>{runtimeInfo ? formatUptime(runtimeInfo.uptime) : "—"}</strong><small>Measured by the hosting runner</small></article>
          <article className="card profileMetric"><span>GATEWAY LATENCY</span><strong>{runtimeInfo?.latencyMs != null ? `${runtimeInfo.latencyMs} ms` : "—"}</strong><small>Discord heartbeat acknowledgement</small></article>
          <article className="card profileMetric"><span>HOST CPU</span><strong>{nodeStats?.cpuPercent != null ? `${nodeStats.cpuPercent}%` : "—"}</strong><small>{nodeStatsError || "Whole VPS host usage, not this bot alone"}</small></article>
          <article className="card profileMetric"><span>HOST MEMORY</span><strong>{nodeStats?.memoryPercent != null ? `${nodeStats.memoryPercent}%` : "—"}</strong><small>{nodeStats?.memoryUsedBytes != null && nodeStats.memoryTotalBytes != null ? `${(nodeStats.memoryUsedBytes / 1073741824).toFixed(2)} / ${(nodeStats.memoryTotalBytes / 1073741824).toFixed(2)} GiB used` : "Waiting for Linux host metrics"}</small></article>
          <article className="card profileMetric"><span>HOST DISK</span><strong>{nodeStats?.diskPercent != null ? `${nodeStats.diskPercent}%` : "—"}</strong><small>{nodeStats?.diskUsedBytes != null && nodeStats.diskTotalBytes != null ? `${(nodeStats.diskUsedBytes / 1073741824).toFixed(1)} / ${(nodeStats.diskTotalBytes / 1073741824).toFixed(1)} GiB used` : "Waiting for Linux host metrics"}</small></article>
        </div>

        <div className="botProfileGrid">
          <section className="card botInfoCard">
            <span className="dashboardLabel">DISCORD ACCOUNT</span>
            <h2>{bot.discord_username || "Discord bot"}</h2>
            <div className="infoRows">
              <div><span>Discord bot ID</span><b>{bot.discord_bot_id || "—"}</b></div>
              <div><span>Credential status</span><b>{connected ? "Validated" : "Not validated"}</b></div>
              <div><span>Token</span><b>Encrypted & hidden</b></div>
              <div><span>Last record update</span><b>{formatDate(bot.updated_at)}</b></div>
            </div>
          </section>

          <section className="card botInfoCard">
            <span className="dashboardLabel">RUNTIME</span>
            <h2>{bot.runtime === "node" ? "Node.js" : "Python"}</h2>
            <div className="infoRows">
              <div><span>Runtime selection</span><b>{bot.runtime}</b></div>
              <div><span>Runner status</span><b>{runtimeInfo ? "Reachable" : "Unavailable"}</b></div>
              <div><span>Hosting uptime</span><b>{runtimeInfo ? formatUptime(runtimeInfo.uptime) : "—"}</b></div>
              <div><span>Project file deployment</span><b>Not enabled yet</b></div>
              <div><span>Last created</span><b>{formatDate(bot.created_at)}</b></div>
            </div>
          </section>
        </div>

        <section className="card botConsoleCard">
          <div className="botConsoleHeader">
            <div><span className="dashboardLabel">HOSTING RUNNER</span><h2>Console</h2></div>
            <span className="consoleCount">{consoleLogs.length} recent events</span>
          </div>
          {logsError && <p className="consoleEmpty">{logsError}</p>}
          {!logsError && consoleLogs.length === 0 && <p className="consoleEmpty">No runner events yet. Start the bot to see connection and lifecycle messages here.</p>}
          {consoleLogs.length > 0 && <div className="botConsole" role="log" aria-live="polite">
            {consoleLogs.map((entry, index) => (
              <div className="consoleLine" key={`${entry.time}-${index}`}>
                <time>{new Date(entry.time).toLocaleTimeString()}</time>
                <b className={`consoleLevel consoleLevel${entry.level}`}>{entry.level}</b>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>}
          <p className="consoleFootnote">Lifecycle and error metadata only. This is not yet a stream of arbitrary project stdout/stderr.</p>
        </section>

        {runtimeInfo?.lastError && <div className="dashboardNotice" role="status"><span>!</span>Runner report: {runtimeInfo.lastError}</div>}

        <section className="card botSecurityNote">
          <strong>🔒 Security and current capability</strong>
          <p>Your token is not displayed here. BotVault sends process actions from the server to the runner; keep VPS_API_KEY and BOT_TOKEN_ENCRYPTION_KEY in server-side secrets only. The current runner connects a Discord bot and supports configured simple commands, but it does not yet upload and execute arbitrary user project files. CPU/RAM metrics and console streaming are not shown as live until their authenticated node endpoints are connected.</p>
        </section>
      </section>
    </main>
  );
}
