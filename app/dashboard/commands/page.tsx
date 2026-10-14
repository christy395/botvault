"use client";

import { useEffect, useMemo, useState } from "react";

type BotCommand = {
  id: string;
  name: string;
  description: string;
  code: string;
  language: "python" | "javascript";
};

export default function CommandsPage() {
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [selected, setSelected] = useState<BotCommand | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<BotCommand["language"]>("python");
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageKey, setStorageKey] = useState("botvault.commands");
  const [botId, setBotId] = useState("");
  const [botName, setBotName] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [codingMode, setCodingMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scopedBotId = params.get("botId") || "";
    const requestedMode = params.get("mode") === "code";
    setBotId(scopedBotId);
    setCodingMode(requestedMode);
    const key = scopedBotId ? `botvault.commands.${scopedBotId}` : "botvault.commands";
    setStorageKey(key);
    if (scopedBotId) {
      fetch(`/api/bots/${encodeURIComponent(scopedBotId)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (response.ok && data.bot?.name) setBotName(data.bot.name);
        })
        .catch(() => undefined);
    }
    try {
      const saved = window.localStorage.getItem(key);
      const parsed: BotCommand[] = saved ? JSON.parse(saved) : [];
      const validCommands = Array.isArray(parsed) ? parsed.filter((command) => command && command.name) : [];
      setCommands(validCommands);
      window.localStorage.setItem(key, JSON.stringify(validCommands));
    } catch {
      setCommands([]);
      window.localStorage.setItem(key, "[]");
    }
  }, []);

  useEffect(() => {
    setCodeDraft(selected?.code || "");
  }, [selected]);

  const saveCommands = (next: BotCommand[]) => {
    setCommands(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const saveCode = () => {
    if (!selected) return;
    const updated = { ...selected, code: codeDraft };
    saveCommands(commands.map((command) => command.id === selected.id ? updated : command));
    setSelected(updated);
    flash("Code saved in this browser's command library.");
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const starterCode = useMemo(() => language === "python"
    ? 'import discord\n\n@tree.command(name="mycommand", description="My command")\nasync def mycommand(interaction: discord.Interaction):\n    await interaction.response.send_message("Hello from BotVault!")'
    : 'import { SlashCommandBuilder } from "discord.js";\n\nexport const data = new SlashCommandBuilder()\n  .setName("mycommand")\n  .setDescription("My command");\n\nexport async function execute(interaction) {\n  await interaction.reply("Hello from BotVault!");\n}',
  [language]);

  const createCommand = () => {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanName) return flash("Enter a command name first.");
    const command: BotCommand = {
      id: crypto.randomUUID(),
      name: cleanName,
      description: description.trim() || "BotVault command",
      language,
      code: starterCode,
    };
    saveCommands([...commands, command]);
    setSelected(command);
    setName("");
    setDescription("");
    flash(`/${cleanName} was added to your command library.`);
  };

  const generateWithAI = async () => {
    if (!prompt.trim()) return flash("Describe what you want the AI command to do.");
    setAiBusy(true);
    try {
      const response = await fetch("/api/commands/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI generation failed.");
      const generated: BotCommand = {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description,
        code: data.code,
        language,
      };
      saveCommands([...commands, generated]);
      setSelected(generated);
      flash(`AI created /${generated.name}. Review the code before deploying it.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "AI generation failed.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <main className="dashboardPage">
      <nav className="nav">
        <a className="brand" href="/">BOT<span>VAULT</span></a>
        <div className="dashboardNav">
          <a href="/dashboard">Dashboard</a>
          <span className="dashboardUser">Commands</span>
        </div>
      </nav>

      <section className="dashboardShell commandsShell">
        <div className="dashboardHeader">
          <div>
            <span className="eyebrow dashboardEyebrow"><span /> COMMAND BUILDER</span>
            <h1>{botName ? `Build commands for ${botName}.` : "Build your bot commands."}</h1>
            <p>Create commands visually, ask AI for a starter, or switch to coding mode and write Python or JavaScript yourself. {botId ? "This command library is scoped to the selected bot in this browser." : "Choose a bot profile to keep commands separated by bot."}</p>
          </div>
          <div className="commandBuilderShortcutActions">
            <button className={codingMode ? "secondary" : "primary"} onClick={() => setCodingMode(false)}>Visual Builder</button>
            <button className={codingMode ? "primary" : "secondary"} onClick={() => setCodingMode(true)}>{"</>"} Build with Coding</button>
            <a className="secondary" href={botId ? `/dashboard/bots/${encodeURIComponent(botId)}` : "/dashboard"}>← {botId ? "Bot profile" : "Dashboard"}</a>
          </div>
        </div>

        {notice && <div className="dashboardNotice" role="status"><span>!</span>{notice}</div>}

        {codingMode && (
          <section className="codePanel card codingModePanel">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">CODE EDITOR</span><h2>Build with code</h2></div>
              <label className="codingRuntimeLabel">Language
                <select value={language} onChange={(event) => setLanguage(event.target.value as BotCommand["language"])}>
                  <option value="python">Python / discord.py</option>
                  <option value="javascript">JavaScript / discord.js</option>
                </select>
              </label>
            </div>
            <p className="helperText">Select a command from your library below to edit its source, or create a command first. This editor saves code in this browser; it does not execute or deploy code to a live bot yet.</p>
            {selected ? (
              <>
                <div className="codingSelectedMeta"><strong>/{selected.name}</strong><span>{selected.language === "python" ? "Python" : "JavaScript"}</span></div>
                <textarea className="codeEditorTextarea" aria-label="Command source code" spellCheck={false} value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} />
                <div className="codingEditorActions">
                  <button className="primary" onClick={saveCode}>Save code</button>
                  <button className="secondary" onClick={() => navigator.clipboard?.writeText(codeDraft).then(() => flash("Code copied."))}>Copy code</button>
                </div>
              </>
            ) : <div className="emptyState"><div className="emptyIcon">{"</>"}</div><h3>Select or create a command</h3><p>Choose a command from the library below to edit its code.</p></div>}
          </section>
        )}

        <div className="commandWorkspace">
          <section className="commandPanel card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">MANUAL</span><h2>Create command</h2></div>
            </div>
            <label>Command name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="welcome" /></label>
            <label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Send a welcome message" /></label>
            <label>Runtime<select value={language} onChange={(e) => setLanguage(e.target.value as BotCommand["language"])}><option value="python">Python / discord.py</option><option value="javascript">JavaScript / discord.js</option></select></label>
            <button className="primary commandButton" onClick={createCommand}>Add command <b>→</b></button>
          </section>

          <section className="commandPanel aiPanel card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">AI BUILDER</span><h2>Make a command with AI</h2></div>
              <span className="aiBadge">AI</span>
            </div>
            <label>Tell the AI what the command should do<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Example: Make a /serverinfo command that shows the server name, member count, owner and creation date in an embed." /></label>
            <p className="helperText">The AI generates code for your selected runtime. Always review generated code before running it on a real bot.</p>
            <button className="primary commandButton" onClick={generateWithAI} disabled={aiBusy}>{aiBusy ? "Generating…" : "✨ Generate with AI"}</button>
          </section>
        </div>

        <section className="commandsList card">
          <div className="dashboardCardHead"><div><span className="dashboardLabel">COMMANDS</span><h2>Your command library</h2></div><span className="commandCount">{commands.length}</span></div>
          {commands.length === 0 ? <div className="emptyState"><div className="emptyIcon">/</div><h3>No commands yet</h3><p>Create your first slash command above.</p></div> : (
            <div className="commandRows">
              {commands.map((command) => (
                <button className={selected?.id === command.id ? "commandRow selected" : "commandRow"} key={command.id} onClick={() => setSelected(command)}>
                  <span className="commandIcon">/</span>
                  <span><strong>/{command.name}</strong><small>{command.description}</small></span>
                  <em>{command.language === "python" ? "PY" : "JS"}</em>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="codePanel card">
            <div className="dashboardCardHead">
              <div><span className="dashboardLabel">COMMAND CODE</span><h2>/{selected.name}</h2></div>
              <button className="secondary smallButton" onClick={() => navigator.clipboard?.writeText(selected.code).then(() => flash("Command code copied."))}>Copy code</button>
            </div>
            <p className="codeDescription">{selected.description}</p>
            {!codingMode && <pre><code>{selected.code}</code></pre>}
            {codingMode && <button className="secondary smallButton" onClick={() => setCodeDraft(selected.code)}>Reset editor to saved code</button>}
            <div className="integrationNote"><strong>Deployment:</strong> Commands are saved to this browser while the BotVault hosting controller is not connected. Once a bot node/API is connected, this command library can be synced into the bot runtime instead of pretending a deployment happened.</div>
          </section>
        )}
      </section>
    </main>
  );
}
